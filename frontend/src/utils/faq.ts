export interface FAQItem {
  question: string
  answer: string
}

export const faqData: Record<'ru' | 'en', FAQItem[]> = {
  ru: [
    {
      question: 'Как создать заметку?',
      answer: 'Нажмите на кнопку создания заметки в правом нижнем углу на главной странице или в разделе заметок.'
    },
    {
      question: 'Как установить дедлайн?',
      answer: 'Откройте заметку, переключитесь в режим Todo, и нажмите на иконку будильника для установки дедлайна.'
    },
    {
      question: 'Как работают уведомления?',
      answer: 'Уведомления отправляются за указанное время до дедлайна. Вы можете настроить это время в настройках.'
    },
    {
      question: 'Как изменить тему оформления?',
      answer: 'Перейдите в настройки и выберите светлую или тёмную тему.'
    },
    {
      question: 'Как изменить язык интерфейса?',
      answer: 'В настройках выберите нужный язык из списка доступных языков.'
    },
    {
      question: 'Как организовать заметки в папки?',
      answer: 'Вы можете создавать папки и перемещать заметки между ними. Используйте кнопку выбора папки в редакторе заметки.'
    }
  ],
  en: [
    {
      question: 'How to create a note?',
      answer: 'Click the create note button in the bottom right corner on the home page or in the notes section.'
    },
    {
      question: 'How to set a deadline?',
      answer: 'Open a note, switch to Todo mode, and click the alarm icon to set a deadline.'
    },
    {
      question: 'How do notifications work?',
      answer: 'Notifications are sent at the specified time before the deadline. You can configure this time in settings.'
    },
    {
      question: 'How to change the theme?',
      answer: 'Go to settings and select light or dark theme.'
    },
    {
      question: 'How to change the interface language?',
      answer: 'In settings, select the desired language from the list of available languages.'
    },
    {
      question: 'How to organize notes in folders?',
      answer: 'You can create folders and move notes between them. Use the folder selection button in the note editor.'
    }
  ]
}

export const privacyPolicy: Record<'ru' | 'en', string> = {
  ru: `Политика конфиденциальности

1. Сбор информации
Мы собираем только необходимую информацию для работы приложения:
- Имя пользователя и уникальный идентификатор
- Заметки и задачи, созданные вами
- Настройки приложения

2. Использование информации
Ваша информация используется исключительно для:
- Предоставления функциональности приложения
- Улучшения работы сервиса
- Отправки уведомлений о дедлайнах

3. Защита данных
Мы применяем современные методы защиты данных:
- Шифрование при передаче данных
- Безопасное хранение на серверах
- Ограниченный доступ к данным

4. Передача данных третьим лицам
Мы не передаем ваши данные третьим лицам, за исключением случаев, предусмотренных законодательством.

5. Ваши права
Вы имеете право:
- Просматривать свои данные
- Изменять свои данные
- Удалять свои данные
- Отозвать согласие на обработку данных

6. Изменения в политике
Мы можем обновлять данную политику конфиденциальности. О существенных изменениях мы уведомим вас.`,
  
  en: `Privacy Policy

1. Information Collection
We collect only the necessary information for the application to work:
- Username and unique identifier
- Notes and tasks created by you
- Application settings

2. Use of Information
Your information is used solely for:
- Providing application functionality
- Improving service performance
- Sending deadline notifications

3. Data Protection
We use modern data protection methods:
- Data encryption during transmission
- Secure storage on servers
- Limited access to data

4. Sharing Data with Third Parties
We do not share your data with third parties, except as required by law.

5. Your Rights
You have the right to:
- View your data
- Modify your data
- Delete your data
- Withdraw consent for data processing

6. Policy Changes
We may update this privacy policy. We will notify you of significant changes.`
}

export const termsOfService: Record<'ru' | 'en', string> = {
  ru: `Пользовательское соглашение

1. Принятие условий
Используя данное приложение, вы соглашаетесь с условиями данного соглашения. Если вы не согласны с условиями, пожалуйста, не используйте приложение.

2. Описание сервиса
Приложение предоставляет функциональность для:
- Создания и управления заметками
- Создания и управления задачами
- Установки дедлайнов
- Получения уведомлений

3. Обязанности пользователя
Вы обязуетесь:
- Использовать приложение в соответствии с его назначением
- Не нарушать права других пользователей
- Не использовать приложение для незаконных целей
- Сохранять конфиденциальность своих учетных данных

4. Ограничение ответственности
Приложение предоставляется "как есть" без каких-либо гарантий. Мы не несем ответственности за:
- Потерю данных
- Прерывание работы сервиса
- Любые косвенные убытки

5. Интеллектуальная собственность
Все права на приложение принадлежат его разработчикам. Вы не можете копировать, модифицировать или распространять приложение без разрешения.

6. Изменения в соглашении
Мы можем изменять данное соглашение. Продолжение использования приложения после изменений означает ваше согласие с новыми условиями.`,
  
  en: `Terms of Service

1. Acceptance of Terms
By using this application, you agree to the terms of this agreement. If you do not agree to the terms, please do not use the application.

2. Service Description
The application provides functionality for:
- Creating and managing notes
- Creating and managing tasks
- Setting deadlines
- Receiving notifications

3. User Responsibilities
You agree to:
- Use the application in accordance with its intended purpose
- Not violate the rights of other users
- Not use the application for illegal purposes
- Maintain the confidentiality of your credentials

4. Limitation of Liability
The application is provided "as is" without any warranties. We are not responsible for:
- Data loss
- Service interruptions
- Any indirect damages

5. Intellectual Property
All rights to the application belong to its developers. You may not copy, modify, or distribute the application without permission.

6. Changes to Agreement
We may change this agreement. Continued use of the application after changes means you agree to the new terms.`
}

