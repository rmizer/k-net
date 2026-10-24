import { useState } from 'react'
import { DocumentFormDialog } from '../../documents/DocumentFormDialog'

interface ReceiptButtonProps {
  /** Starting values, e.g. the store a shopping list was for. */
  defaults?: { title?: string; vendor?: string }
  label?: string
  className?: string
  onSent: (message: string) => void
}

/** Upload a receipt: on a phone, the file picker offers the camera or the photo library. */
export function ReceiptButton({ defaults, label = 'Upload receipt', className = 'button', onSent }: ReceiptButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <DocumentFormDialog
          document={null}
          initialCategory="receipt"
          canChooseCategory={false}
          defaults={defaults}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            onSent('Receipt sent. You can follow it in Resources → Paperwork.')
          }}
        />
      )}
    </>
  )
}
