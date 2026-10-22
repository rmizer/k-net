import { formatDay } from '../../../format'
import type { ShoppingList } from '../../../types'

export const shopBy = (list: Pick<ShoppingList, 'needed_by'>) =>
  list.needed_by ? `Shop by ${formatDay(list.needed_by, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'No deadline'
