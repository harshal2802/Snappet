export type CardColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'

export interface Card {
  id: string
  title: string
  description: string
  color: CardColor
  createdAt: number
}

export interface Column {
  id: string
  title: string
  cards: Card[]
}

export type Board = Column[]
