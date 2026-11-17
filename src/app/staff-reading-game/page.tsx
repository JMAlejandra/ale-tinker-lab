import { type Metadata } from 'next'

import { StaffReadingGame } from './_components/staff-reading-game'

export const metadata: Metadata = {
  title: 'Staff Reading Game',
  description: 'Practise reading notes on the staff: place them or name them.',
}

export default function StaffReadingGamePage() {
  return <StaffReadingGame />
}
