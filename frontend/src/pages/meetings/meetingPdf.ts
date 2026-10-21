import { toLocalInput } from '../../format'
import type { MeetingNote } from '../../types'

export const meetingTitle = (note: Pick<MeetingNote, 'title'>) => note.title.trim() || 'Meeting notes'

/** "Wednesday, October 21, 2026, 2:00 PM" in the viewer's time zone. */
export const meetingWhen = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso))

/** Downloads the notes as a PDF: title, date and time, attendees, then the notes. */
export async function downloadMeetingPdf(note: MeetingNote) {
  // Loaded on first use: it's large, and only needed here.
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 54
  const width = pdf.internal.pageSize.getWidth() - margin * 2
  const bottom = pdf.internal.pageSize.getHeight() - margin
  let y = margin

  const write = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color = '#000000') => {
    pdf.setFont('helvetica', style).setFontSize(size).setTextColor(color)
    const lineHeight = size * 1.35
    for (const line of pdf.splitTextToSize(text, width) as string[]) {
      if (y + lineHeight > bottom) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y + size)
      y += lineHeight
    }
  }

  write('K-NET · MEETING NOTES', 9, 'bold', '#880101')
  y += 4
  write(meetingTitle(note), 20, 'bold')
  write(meetingWhen(note.meeting_at), 12)
  if (note.created_by_name) write(`Notes taken by ${note.created_by_name}`, 10, 'normal', '#5c5555')
  y += 12

  write('ATTENDEES', 9, 'bold', '#880101')
  write(note.attendee_names.length ? note.attendee_names.join(', ') : 'None listed', 11)
  y += 12

  write('NOTES', 9, 'bold', '#880101')
  write(note.notes.trim() || 'No notes.', 11)

  const day = toLocalInput(note.meeting_at).slice(0, 10)
  const name = meetingTitle(note).replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-')
  pdf.save(`${name || 'Meeting-notes'}-${day}.pdf`)
}
