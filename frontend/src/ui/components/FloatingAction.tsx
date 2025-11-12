export default function FloatingAction({ label, onClick }: { label: string; onClick: () => void }){
  return (
    <button className="fab" onClick={onClick} aria-label={label} title={label}>
      +
    </button>
  )
}


