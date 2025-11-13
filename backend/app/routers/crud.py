from datetime import datetime, timezone
from typing import List, Set, Tuple
import re
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import delete, insert

from ..db import get_db
from ..deps import get_current_user
from ..models.todo import Task, Note, Tag, Folder, note_tag, task_tag, Deadline, DeadlineNotification
from ..schemas import (
    TaskCreate,
    TaskOut,
    TaskUpdate,
    NoteCreate,
    NoteOut,
    NoteUpdate,
    TagOut,
    FolderCreate,
    FolderOut,
    FolderUpdate,
    DeadlineCreate,
    DeadlineUpdate,
    DeadlineOut,
)


router = APIRouter(prefix="/api", tags=["crud"])


def _extract_hashtags(text: str | None) -> Set[str]:
    """Извлекает имена тегов из текста с хэштегами"""
    if not text:
        return set()
    pattern = re.compile(r"#([A-Za-zА-Яа-я0-9_]+)")
    return {m.group(1).lower() for m in pattern.finditer(text)}


def _generate_color(name: str) -> str:
    """Генерирует цвет на основе имени тега"""
    hash_obj = hashlib.md5(name.encode())
    hash_int = int(hash_obj.hexdigest(), 16)
    colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
        "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52BE80",
        "#EC7063", "#5DADE2", "#F4D03F", "#82E0AA", "#F1948A",
        "#7FB3D3", "#F5B041", "#AED6F1", "#A9DFBF", "#F9E79F"
    ]
    return colors[hash_int % len(colors)]


def _get_or_create_tags(db: Session, tag_names: Set[str]) -> List[Tag]:
    """Получает существующие теги или создает новые"""
    if not tag_names:
        return []
    
    # Получаем существующие теги
    existing_tags = db.query(Tag).filter(Tag.name.in_(list(tag_names))).all()
    existing_names = {tag.name for tag in existing_tags}
    
    # Создаем новые теги
    new_tags = []
    for name in tag_names:
        if name not in existing_names:
            tag = Tag(name=name, color=_generate_color(name))
            db.add(tag)
            new_tags.append(tag)
    
    if new_tags:
        db.flush()  # Сохраняем новые теги, но не коммитим
    
    return existing_tags + new_tags


def _update_tags_for_item(db: Session, item, tag_names: Set[str], item_id: int, is_note: bool = False):
    """Обновляет теги для задачи или заметки через прямой SQL"""
    # Получаем или создаем теги
    tags = _get_or_create_tags(db, tag_names)
    
    # Определяем промежуточную таблицу
    association_table = note_tag if is_note else task_tag
    id_column = "note_id" if is_note else "task_id"
    
    # Удаляем все существующие связи
    db.execute(delete(association_table).where(association_table.c[id_column] == item_id))
    
    # Добавляем новые связи
    if tags:
        values = [{id_column: item_id, "tag_id": tag.id} for tag in tags]
        db.execute(insert(association_table).values(values))
    
    db.flush()


# Tags
@router.get("/tags", response_model=List[TagOut])
def list_tags(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Tag).order_by(Tag.name.asc()).all()


# Tasks
@router.get("/tasks", response_model=List[TaskOut])
def list_tasks(tag_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    query = db.query(Task).options(joinedload(Task.tags)).filter(
        Task.user_id == user.id
    )
    
    # Фильтр по тегу
    if tag_id is not None:
        # Используем exists для более надежной фильтрации
        from sqlalchemy import exists
        query = query.filter(
            exists().where(
                (task_tag.c.task_id == Task.id) & 
                (task_tag.c.tag_id == tag_id)
            )
        )
    
    tasks = query.order_by(Task.created_at.desc()).all()
    
    result = []
    for t in tasks:
        # Явно преобразуем теги
        tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (t.tags or [])]
        result.append(TaskOut(
            id=t.id,
            title=t.title,
            description=t.description,
            due_at=t.due_at.isoformat() if t.due_at else None,
            is_completed=t.is_completed,
            tags=tags_list
        ))
    return result


@router.post("/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    due_dt = datetime.fromisoformat(payload.due_at) if payload.due_at else None
    task = Task(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        due_at=due_dt
    )
    
    db.add(task)
    db.flush()  # Сохраняем задачу чтобы получить ID
    task_id = task.id
    
    # Обрабатываем теги ПОСЛЕ добавления задачи в сессию
    if payload.tags_text:
        tag_names = _extract_hashtags(payload.tags_text)
        _update_tags_for_item(db, task, tag_names, task_id, is_note=False)
    
    db.commit()
    
    # Перезагружаем с тегами
    task = db.query(Task).options(joinedload(Task.tags)).filter(Task.id == task_id).first()
    
    tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (task.tags or [])]
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        due_at=task.due_at.isoformat() if task.due_at else None,
        is_completed=task.is_completed,
        tags=tags_list
    )


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    task = db.query(Task).options(joinedload(Task.tags)).filter(
        Task.id == task_id,
        Task.user_id == user.id
    ).first()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Обновляем поля
    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.due_at is not None:
        task.due_at = datetime.fromisoformat(payload.due_at) if payload.due_at else None
    if payload.is_completed is not None:
        task.is_completed = payload.is_completed
    
    # Обновляем теги
    if payload.tags_text is not None:
        tag_names = _extract_hashtags(payload.tags_text)
        _update_tags_for_item(db, task, tag_names, task_id, is_note=False)
    
    db.commit()
    
    # Перезагружаем с тегами
    task = db.query(Task).options(joinedload(Task.tags)).filter(Task.id == task_id).first()
    
    tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (task.tags or [])]
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        due_at=task.due_at.isoformat() if task.due_at else None,
        is_completed=task.is_completed,
        tags=tags_list
    )


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    task = db.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    db.delete(task)
    db.commit()
    return {"ok": True}


# Folders
def _get_or_create_default_folder(db: Session, user_id: int, commit_if_new: bool = False) -> Tuple[Folder, bool]:
    """Получает или создает папку 'Все' для пользователя
    
    Returns:
        tuple: (Folder, was_created) - папка и флаг, была ли она создана
    """
    try:
        default_folder = db.query(Folder).filter(
            Folder.user_id == user_id,
            Folder.is_default == True
        ).first()
        
        was_created = False
        if not default_folder:
            default_folder = Folder(
                user_id=user_id,
                name="Все",
                is_default=True
            )
            db.add(default_folder)
            db.flush()  # Используем flush вместо commit, чтобы не нарушать транзакцию
            db.refresh(default_folder)
            was_created = True
            if commit_if_new:
                db.commit()
        
        if default_folder is None:
            raise ValueError(f"Не удалось создать или получить папку 'Все' для пользователя {user_id}")
        
        return default_folder, was_created
    except Exception as e:
        import traceback
        print(f"Error in _get_or_create_default_folder: {e}")
        print(traceback.format_exc())
        raise


@router.get("/folders", response_model=List[FolderOut])
def list_folders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Убеждаемся что папка "Все" существует
    _, was_created = _get_or_create_default_folder(db, user.id, commit_if_new=True)
    
    folders = db.query(Folder).filter(
        Folder.user_id == user.id
    ).order_by(Folder.is_default.desc(), Folder.created_at.asc()).all()
    
    result = []
    for f in folders:
        result.append(FolderOut(
            id=f.id,
            name=f.name,
            is_default=f.is_default,
            created_at=f.created_at.isoformat() if f.created_at else ""
        ))
    return result


@router.post("/folders", response_model=FolderOut)
def create_folder(payload: FolderCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    folder = Folder(
        user_id=user.id,
        name=payload.name,
        is_default=False
    )
    
    db.add(folder)
    db.commit()
    db.refresh(folder)
    
    return FolderOut(
        id=folder.id,
        name=folder.name,
        is_default=folder.is_default,
        created_at=folder.created_at.isoformat() if folder.created_at else ""
    )


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(folder_id: int, payload: FolderUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.user_id == user.id
    ).first()
    
    if folder is None:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    if folder.is_default:
        raise HTTPException(status_code=400, detail="Нельзя изменить папку 'Все'")
    
    if payload.name is not None:
        folder.name = payload.name
    
    db.commit()
    db.refresh(folder)
    
    return FolderOut(
        id=folder.id,
        name=folder.name,
        is_default=folder.is_default,
        created_at=folder.created_at.isoformat() if folder.created_at else ""
    )


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.user_id == user.id
    ).first()
    
    if folder is None:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    
    if folder.is_default:
        raise HTTPException(status_code=400, detail="Нельзя удалить папку 'Все'")
    
    # Перемещаем заметки из удаляемой папки в папку "Все"
    default_folder, _ = _get_or_create_default_folder(db, user.id, commit_if_new=True)
    db.query(Note).filter(Note.folder_id == folder_id).update({Note.folder_id: default_folder.id})
    
    db.delete(folder)
    db.commit()
    return {"ok": True}


# Notes
@router.get("/notes", response_model=List[NoteOut])
def list_notes(folder_id: int | None = None, tag_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        query = db.query(Note).options(joinedload(Note.tags)).filter(
            Note.user_id == user.id
        )
        
        # Если folder_id указан, проверяем, является ли это папкой "Все"
        # Если это папка "Все" (is_default=True), показываем все заметки пользователя
        # Иначе фильтруем по папке
        if folder_id is not None:
            folder = db.query(Folder).filter(
                Folder.id == folder_id,
                Folder.user_id == user.id
            ).first()
            
            # Если папка существует и это не папка "Все", фильтруем по папке
            # Если это папка "Все" (is_default=True), не фильтруем - показываем все заметки
            if folder and not folder.is_default:
                query = query.filter(Note.folder_id == folder_id)
            # Если folder не найдена или это папка "Все", не фильтруем по folder_id
        
        # Фильтр по тегу
        if tag_id is not None:
            # Используем exists для более надежной фильтрации
            from sqlalchemy import exists
            query = query.filter(
                exists().where(
                    (note_tag.c.note_id == Note.id) & 
                    (note_tag.c.tag_id == tag_id)
                )
            )
        
        # Сортируем: сначала избранные (только одна), потом по дате обновления
        notes = query.order_by(Note.is_favorite.desc(), Note.updated_at.desc()).all()
        
        # Получаем все дедлайны с включенными уведомлениями для заметок пользователя
        note_ids = [n.id for n in notes]
        deadlines_with_notifications = {}
        if note_ids:
            deadlines = db.query(Deadline).filter(
                Deadline.note_id.in_(note_ids),
                Deadline.notification_enabled == True
            ).all()
            for deadline in deadlines:
                deadlines_with_notifications[deadline.note_id] = True
        
        result = []
        for n in notes:
            try:
                # Явно преобразуем теги, обрабатывая возможные ошибки
                tags_list = []
                if n.tags:
                    for tag in n.tags:
                        try:
                            tags_list.append(TagOut(id=tag.id, name=tag.name, color=tag.color))
                        except Exception as tag_error:
                            print(f"Error processing tag {tag.id}: {tag_error}")
                            continue
                
                # Проверяем, есть ли у заметки дедлайн с включенными уведомлениями
                has_deadline_notifications = deadlines_with_notifications.get(n.id, False)
                
                result.append(NoteOut(
                    id=n.id,
                    title=n.title,
                    content=n.content,
                    folder_id=n.folder_id,
                    is_favorite=n.is_favorite if hasattr(n, 'is_favorite') else False,
                    tags=tags_list,
                    has_deadline_notifications=has_deadline_notifications
                ))
            except Exception as note_error:
                print(f"Error processing note {n.id}: {note_error}")
                import traceback
                traceback.print_exc()
                continue
        
        return result
    except Exception as e:
        import traceback
        print(f"Error in list_notes: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Ошибка при получении заметок: {str(e)}")


@router.post("/notes", response_model=NoteOut)
def create_note(payload: NoteCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        print(f"Creating note for user {user.id}, payload: {payload}")
        
        # Если folder_id не указан, используем папку "Все"
        folder_id = payload.folder_id
        if folder_id is None:
            default_folder, _ = _get_or_create_default_folder(db, user.id)
            folder_id = default_folder.id
            print(f"Using default folder with id: {folder_id}")
        else:
            # Проверяем, что папка существует и принадлежит пользователю
            folder = db.query(Folder).filter(
                Folder.id == folder_id,
                Folder.user_id == user.id
            ).first()
            if folder is None:
                raise HTTPException(status_code=404, detail="Папка не найдена")
            print(f"Using folder with id: {folder_id}")
        
        note = Note(
            user_id=user.id,
            folder_id=folder_id,
            title=payload.title,
            content=payload.content
        )
        
        db.add(note)
        db.flush()  # Сохраняем заметку чтобы получить ID
        note_id = note.id
        print(f"Note created with id: {note_id}")
        
        # Обрабатываем теги ПОСЛЕ добавления заметки в сессию
        if payload.tags_text:
            tag_names = _extract_hashtags(payload.tags_text)
            _update_tags_for_item(db, note, tag_names, note_id, is_note=True)
        
        db.commit()
        print(f"Note committed, reloading...")
        
        # Перезагружаем с тегами
        note = db.query(Note).options(joinedload(Note.tags)).filter(Note.id == note_id).first()
        
        if note is None:
            raise HTTPException(status_code=500, detail="Не удалось загрузить созданную заметку")
        
        tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (note.tags or [])]
        
        # Проверяем, есть ли у заметки дедлайн с включенными уведомлениями
        deadline = db.query(Deadline).filter(
            Deadline.note_id == note.id,
            Deadline.notification_enabled == True
        ).first()
        has_deadline_notifications = deadline is not None
        
        result = NoteOut(
            id=note.id,
            title=note.title,
            content=note.content,
            folder_id=note.folder_id,
            is_favorite=note.is_favorite if hasattr(note, 'is_favorite') else False,
            tags=tags_list,
            has_deadline_notifications=has_deadline_notifications
        )
        print(f"Note created successfully: {result.id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"Error creating note: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Ошибка при создании заметки: {str(e)}")


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    note = db.query(Note).options(joinedload(Note.tags)).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Обновляем поля
    # Используем exclude_unset=True, чтобы обновлять только переданные поля (включая None)
    payload_dict = payload.dict(exclude_unset=True)
    
    if 'title' in payload_dict:
        note.title = payload_dict['title']
    if 'content' in payload_dict:
        note.content = payload_dict['content']  # Может быть None для очистки content
    if 'folder_id' in payload_dict:
        note.folder_id = payload_dict['folder_id']
    
    # Обновляем теги (если tags_text был передан, даже если это пустая строка)
    if 'tags_text' in payload_dict:
        tag_names = _extract_hashtags(payload_dict['tags_text'] or '')
        _update_tags_for_item(db, note, tag_names, note_id, is_note=True)
    
    db.commit()
    
    # Перезагружаем с тегами
    note = db.query(Note).options(joinedload(Note.tags)).filter(Note.id == note_id).first()
    
    tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (note.tags or [])]
    
    # Проверяем, есть ли у заметки дедлайн с включенными уведомлениями
    deadline = db.query(Deadline).filter(
        Deadline.note_id == note_id,
        Deadline.notification_enabled == True
    ).first()
    has_deadline_notifications = deadline is not None
    
    return NoteOut(
        id=note.id,
        title=note.title,
        content=note.content,
        folder_id=note.folder_id,
        is_favorite=note.is_favorite if hasattr(note, 'is_favorite') else False,
        tags=tags_list,
        has_deadline_notifications=has_deadline_notifications
    )


@router.post("/notes/{note_id}/favorite", response_model=NoteOut)
def toggle_favorite_note(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Устанавливает заметку в избранное. Если заметка уже в избранном, снимает её. 
    Если устанавливается новая заметка в избранное, старая автоматически снимается."""
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Если заметка уже в избранном, просто снимаем её
    if note.is_favorite:
        note.is_favorite = False
        # При снятии избранного обновляем updated_at на старую дату,
        # чтобы заметка вернулась на свое место в списке (не оставалась вверху)
        # Используем created_at как базовую дату, чтобы заметка переместилась вниз
        from datetime import timezone, timedelta
        # Устанавливаем updated_at на created_at плюс небольшой интервал,
        # чтобы заметка была отсортирована по дате создания, а не по последнему обновлению
        note.updated_at = note.created_at + timedelta(seconds=1)
    else:
        # Снимаем избранное со всех других заметок пользователя
        db.query(Note).filter(
            Note.user_id == user.id,
            Note.is_favorite == True
        ).update({"is_favorite": False})
        # Устанавливаем текущую заметку в избранное
        note.is_favorite = True
        # При установке в избранное НЕ обновляем updated_at,
        # чтобы заметка сохраняла свою позицию
    
    db.commit()
    
    # Перезагружаем с тегами для ответа
    note = db.query(Note).options(joinedload(Note.tags)).filter(Note.id == note_id).first()
    tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (note.tags or [])]
    
    # Проверяем, есть ли у заметки дедлайн с включенными уведомлениями
    deadline = db.query(Deadline).filter(
        Deadline.note_id == note_id,
        Deadline.notification_enabled == True
    ).first()
    has_deadline_notifications = deadline is not None
    
    return NoteOut(
        id=note.id,
        title=note.title,
        content=note.content,
        folder_id=note.folder_id,
        is_favorite=note.is_favorite,
        tags=tags_list,
        has_deadline_notifications=has_deadline_notifications
    )


@router.get("/notes/favorite", response_model=NoteOut | None)
def get_favorite_note(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Получает избранную заметку пользователя"""
    note = db.query(Note).options(joinedload(Note.tags)).filter(
        Note.user_id == user.id,
        Note.is_favorite == True
    ).first()
    
    if note is None:
        return None
    
    tags_list = [TagOut(id=tag.id, name=tag.name, color=tag.color) for tag in (note.tags or [])]
    
    # Проверяем, есть ли у заметки дедлайн с включенными уведомлениями
    deadline = db.query(Deadline).filter(
        Deadline.note_id == note.id,
        Deadline.notification_enabled == True
    ).first()
    has_deadline_notifications = deadline is not None
    
    return NoteOut(
        id=note.id,
        title=note.title,
        content=note.content,
        folder_id=note.folder_id,
        is_favorite=note.is_favorite,
        tags=tags_list,
        has_deadline_notifications=has_deadline_notifications
    )


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    note = db.get(Note, note_id)
    if note is None or note.user_id != user.id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    db.delete(note)
    db.commit()
    return {"ok": True}


# Deadlines
def _is_todo_note(content: str | None) -> bool:
    """Проверяет, является ли заметка todo-заметкой."""
    if not content:
        return False
    try:
        parsed = json.loads(content)
        return parsed.get("type") == "todo" and isinstance(parsed.get("items"), list)
    except:
        return False


def _calculate_deadline_info(deadline_at: datetime) -> dict:
    """Вычисляет информацию о дедлайне (оставшееся время, статус, текст)."""
    # Приводим deadline_at к timezone-aware datetime
    if deadline_at.tzinfo is None:
        deadline_at = deadline_at.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    time_until = deadline_at - now
    total_seconds = int(time_until.total_seconds())
    total_minutes = total_seconds // 60
    total_hours = total_minutes // 60
    days_remaining = total_hours // 24
    
    if total_seconds < 0:
        status = "overdue"
        time_remaining_text = "просрочен"
        days_remaining = 0
    elif days_remaining == 0 and total_hours < 24:
        if total_hours == 0:
            status = "today"
            time_remaining_text = "сегодня"
        else:
            status = "today"
            remaining_mins = total_minutes % 60
            if remaining_mins > 0:
                time_remaining_text = f"сегодня ({total_hours} ч. {remaining_mins} мин.)"
            else:
                time_remaining_text = f"сегодня ({total_hours} ч.)"
    else:
        status = "active"
        remaining_hours = total_hours % 24
        remaining_mins = total_minutes % 60
        
        if days_remaining == 1:
            time_remaining_text = "1 день"
        elif 2 <= days_remaining <= 4:
            time_remaining_text = f"{days_remaining} дня"
        else:
            time_remaining_text = f"{days_remaining} дней"
        
        if remaining_hours > 0:
            time_remaining_text += f" {remaining_hours} {'час' if remaining_hours == 1 else 'часа' if 2 <= remaining_hours <= 4 else 'часов'}"
        if remaining_mins > 0:
            time_remaining_text += f" {remaining_mins} {'минута' if remaining_mins == 1 else 'минуты' if 2 <= remaining_mins <= 4 else 'минут'}"
    
    return {
        "days_remaining": days_remaining,
        "status": status,
        "time_remaining_text": time_remaining_text
    }


@router.post("/deadlines", response_model=DeadlineOut)
def create_deadline(payload: DeadlineCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Создает дедлайн для заметки. Заметка должна быть todo-заметкой."""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == payload.note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Проверяем, что заметка является todo
    if not _is_todo_note(note.content):
        raise HTTPException(status_code=400, detail="Дедлайн можно создать только для todo-заметок")
    
    # Проверяем, нет ли уже дедлайна для этой заметки
    existing_deadline = db.query(Deadline).filter(Deadline.note_id == payload.note_id).first()
    if existing_deadline:
        raise HTTPException(status_code=400, detail="Дедлайн для этой заметки уже существует")
    
    # Парсим дату
    try:
        deadline_str = payload.deadline_at.replace('Z', '+00:00')
        deadline_at = datetime.fromisoformat(deadline_str)
        # Приводим к timezone-aware, если не указан timezone
        if deadline_at.tzinfo is None:
            deadline_at = deadline_at.replace(tzinfo=timezone.utc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Неверный формат даты: {e}")
    
    # Проверяем, что дата не в прошлом
    now = datetime.now(timezone.utc)
    if deadline_at < now:
        raise HTTPException(status_code=400, detail="Дата дедлайна не может быть в прошлом")
    
    # Создаем дедлайн
    deadline = Deadline(
        note_id=payload.note_id,
        user_id=user.id,
        deadline_at=deadline_at,
        notification_enabled=False
    )
    
    db.add(deadline)
    db.commit()
    db.refresh(deadline)
    
    # Вычисляем информацию о дедлайне
    info = _calculate_deadline_info(deadline.deadline_at)
    
    return DeadlineOut(
        id=deadline.id,
        note_id=deadline.note_id,
        deadline_at=deadline.deadline_at.isoformat(),
        notification_enabled=deadline.notification_enabled,
        days_remaining=info["days_remaining"],
        status=info["status"],
        time_remaining_text=info["time_remaining_text"]
    )


@router.get("/deadlines", response_model=List[DeadlineOut])
def get_all_deadlines(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Получает все дедлайны пользователя."""
    # Получаем все дедлайны пользователя
    deadlines = db.query(Deadline).filter(Deadline.user_id == user.id).all()
    
    # Вычисляем информацию о каждом дедлайне
    result = []
    for deadline in deadlines:
        info = _calculate_deadline_info(deadline.deadline_at)
        result.append(DeadlineOut(
            id=deadline.id,
            note_id=deadline.note_id,
            deadline_at=deadline.deadline_at.isoformat(),
            notification_enabled=deadline.notification_enabled,
            days_remaining=info["days_remaining"],
            status=info["status"],
            time_remaining_text=info["time_remaining_text"]
        ))
    
    return result


@router.get("/deadlines/{note_id}", response_model=DeadlineOut)
def get_deadline(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Получает дедлайн для заметки."""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Получаем дедлайн
    deadline = db.query(Deadline).filter(Deadline.note_id == note_id).first()
    
    if deadline is None:
        raise HTTPException(status_code=404, detail="Дедлайн не найден")
    
    # Вычисляем информацию о дедлайне
    info = _calculate_deadline_info(deadline.deadline_at)
    
    return DeadlineOut(
        id=deadline.id,
        note_id=deadline.note_id,
        deadline_at=deadline.deadline_at.isoformat(),
        notification_enabled=deadline.notification_enabled,
        days_remaining=info["days_remaining"],
        status=info["status"],
        time_remaining_text=info["time_remaining_text"]
    )


@router.patch("/deadlines/{note_id}", response_model=DeadlineOut)
def update_deadline(note_id: int, payload: DeadlineUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Обновляет дедлайн для заметки."""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Получаем дедлайн
    deadline = db.query(Deadline).filter(Deadline.note_id == note_id).first()
    
    if deadline is None:
        raise HTTPException(status_code=404, detail="Дедлайн не найден")
    
    # Сохраняем старое время дедлайна для проверки изменений
    old_deadline_at = deadline.deadline_at
    
    # Обновляем поля
    if payload.deadline_at is not None:
        try:
            deadline_str = payload.deadline_at.replace('Z', '+00:00')
            deadline_at = datetime.fromisoformat(deadline_str)
            # Приводим к timezone-aware, если не указан timezone
            if deadline_at.tzinfo is None:
                deadline_at = deadline_at.replace(tzinfo=timezone.utc)
            # Проверяем, что дата не в прошлом
            now = datetime.now(timezone.utc)
            if deadline_at < now:
                raise HTTPException(status_code=400, detail="Дата дедлайна не может быть в прошлом")
            deadline.deadline_at = deadline_at
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Неверный формат даты: {e}")
    
    if payload.notification_enabled is not None:
        old_notification_enabled = deadline.notification_enabled
        deadline.notification_enabled = payload.notification_enabled
        
        # Если уведомления были включены, удаляем старые уведомления для пересчета
        if payload.notification_enabled and not old_notification_enabled:
            from ..models.todo import DeadlineNotification
            db.query(DeadlineNotification).filter(
                DeadlineNotification.deadline_id == deadline.id,
                DeadlineNotification.notification_type != "expired"
            ).delete(synchronize_session=False)
    
    # Если время дедлайна изменилось, удаляем все существующие уведомления (кроме expired)
    # чтобы система могла пересчитать их с новым временем
    if payload.deadline_at is not None:
        # Сравниваем время, учитывая timezone
        old_time = old_deadline_at
        new_time = deadline.deadline_at
        # Приводим к UTC для сравнения
        if old_time.tzinfo is None:
            old_time = old_time.replace(tzinfo=timezone.utc)
        if new_time.tzinfo is None:
            new_time = new_time.replace(tzinfo=timezone.utc)
        # Сравниваем с точностью до секунды
        if abs((old_time - new_time).total_seconds()) > 1:
            from ..models.todo import DeadlineNotification
            db.query(DeadlineNotification).filter(
                DeadlineNotification.deadline_id == deadline.id,
                DeadlineNotification.notification_type != "expired"
            ).delete(synchronize_session=False)
    
    db.commit()
    db.refresh(deadline)
    
    # Вычисляем информацию о дедлайне
    info = _calculate_deadline_info(deadline.deadline_at)
    
    return DeadlineOut(
        id=deadline.id,
        note_id=deadline.note_id,
        deadline_at=deadline.deadline_at.isoformat(),
        notification_enabled=deadline.notification_enabled,
        days_remaining=info["days_remaining"],
        status=info["status"],
        time_remaining_text=info["time_remaining_text"]
    )


@router.delete("/deadlines/{note_id}")
def delete_deadline(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Удаляет дедлайн для заметки."""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Получаем дедлайн
    deadline = db.query(Deadline).filter(Deadline.note_id == note_id).first()
    
    if deadline is None:
        raise HTTPException(status_code=404, detail="Дедлайн не найден")
    
    db.delete(deadline)
    db.commit()
    return {"ok": True}


@router.post("/deadlines/{note_id}/notifications/toggle", response_model=DeadlineOut)
def toggle_deadline_notifications(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Переключает подписку на уведомления для дедлайна."""
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Получаем дедлайн
    deadline = db.query(Deadline).filter(Deadline.note_id == note_id).first()
    
    if deadline is None:
        raise HTTPException(status_code=404, detail="Дедлайн не найден")
    
    # Переключаем подписку
    old_notification_enabled = deadline.notification_enabled
    deadline.notification_enabled = not deadline.notification_enabled
    
    # Если уведомления были включены, удаляем старые уведомления для пересчета
    if deadline.notification_enabled and not old_notification_enabled:
        from ..models.todo import DeadlineNotification
        db.query(DeadlineNotification).filter(
            DeadlineNotification.deadline_id == deadline.id,
            DeadlineNotification.notification_type != "expired"
        ).delete(synchronize_session=False)
    
    db.commit()
    db.refresh(deadline)
    
    # Вычисляем информацию о дедлайне
    info = _calculate_deadline_info(deadline.deadline_at)
    
    return DeadlineOut(
        id=deadline.id,
        note_id=deadline.note_id,
        deadline_at=deadline.deadline_at.isoformat(),
        notification_enabled=deadline.notification_enabled,
        days_remaining=info["days_remaining"],
        status=info["status"],
        time_remaining_text=info["time_remaining_text"]
    )


@router.post("/deadlines/{note_id}/notifications/test")
def test_deadline_notification(note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Отправляет тестовое уведомление о дедлайне пользователю."""
    from ..models.user import User
    from ..services.bot_service import send_message_to_user
    from ..services.notification_service import get_time_until_deadline, format_time_remaining
    
    # Проверяем, что заметка существует и принадлежит пользователю
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Получаем дедлайн
    deadline = db.query(Deadline).filter(Deadline.note_id == note_id).first()
    
    if deadline is None:
        raise HTTPException(status_code=404, detail="Дедлайн не найден")
    
    # Получаем пользователя для отправки уведомления
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user or not db_user.uuid:
        raise HTTPException(status_code=400, detail="UUID пользователя не найден. Войдите через бота для получения уведомлений.")
    
    # Вычисляем оставшееся время
    time_until = get_time_until_deadline(deadline.deadline_at)
    minutes_remaining = int(time_until.total_seconds() / 60)
    
    if minutes_remaining < 0:
        # Для просроченных дедлайнов вычисляем, насколько просрочен
        days_overdue = abs(minutes_remaining) // (24 * 60)
        hours_overdue = (abs(minutes_remaining) % (24 * 60)) // 60
        
        if days_overdue > 0:
            time_text = f"просрочен на {days_overdue} {'день' if days_overdue == 1 else 'дня' if 2 <= days_overdue <= 4 else 'дней'}"
        elif hours_overdue > 0:
            time_text = f"просрочен на {hours_overdue} {'час' if hours_overdue == 1 else 'часа' if 2 <= hours_overdue <= 4 else 'часов'}"
        else:
            time_text = "просрочен"
        message = f'Ручная отправка: до окончания дедлайна "{note.title}" {time_text}'
    else:
        time_text = format_time_remaining(minutes_remaining)
        message = f'Ручная отправка: до окончания дедлайна "{note.title}" осталось {time_text}'
    
    # Отправляем уведомление
    from ..services.message_tracker import track_message
    from ..core.config import settings
    import logging
    logger = logging.getLogger(__name__)
    
    result = send_message_to_user(db_user.uuid, message, image_url=settings.notification_image_url)
    
    if result:
        message_id = result.get("message_id")
        logger.info(f"📤 Результат отправки сообщения: message_id={message_id}, result={result}")
        
        # Отслеживаем сообщение для последующего удаления
        if message_id:
            logger.info(f"✅ Отслеживаем сообщение {message_id} для автоматического удаления")
            track_message(message_id, db_user.uuid, message)
        else:
            logger.warning(f"⚠️ message_id не получен, сообщение не будет отслеживаться для удаления")
        
        return {"ok": True, "message": "Тестовое уведомление отправлено"}
    else:
        raise HTTPException(status_code=500, detail="Не удалось отправить тестовое уведомление")
