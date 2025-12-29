import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import { z } from 'zod';
import { SearchFiltersSchema } from '../lib/types';

type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const SearchFiltersBuilder = Factory.define<SearchFilters>(
  'SearchFilters'
)
  .attr('query', () => faker.helpers.maybe(() => faker.commerce.productName()))
  .attr('max_price', () =>
    faker.helpers.maybe(() =>
      faker.number.float({ min: 100, max: 1000, fractionDigits: 2 })
    )
  )
  .attr('min_price', () =>
    faker.helpers.maybe(() =>
      faker.number.float({ min: 10, max: 99, fractionDigits: 2 })
    )
  )
  .attr('vendor', () => faker.helpers.maybe(() => faker.company.name()))
  .attr('product_type', () =>
    faker.helpers.maybe(() => faker.commerce.department())
  )
  .attr('tags', () =>
    faker.helpers.maybe(() =>
      faker.helpers.arrayElements(
        [faker.commerce.productAdjective(), faker.commerce.productMaterial()],
        { min: 1, max: 3 }
      )
    )
  )
  .attr('exclude_tags', () =>
    faker.helpers.maybe(() =>
      faker.helpers.arrayElements(
        ['discontinued', 'out-of-stock', 'clearance'],
        { min: 1, max: 2 }
      )
    )
  )
  .attr('available_only', () => faker.datatype.boolean({ probability: 0.8 }))
  .attr('limit', () => faker.number.int({ min: 5, max: 20 }));
