import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import { z } from 'zod';
import { ProductCardSchema } from '../lib/types';

type ProductCard = z.infer<typeof ProductCardSchema>;

export const ProductCardBuilder = Factory.define<ProductCard>('ProductCard')
  .attr('id', () => faker.number.int({ min: 1, max: 999999 }))
  .attr('title', () => faker.commerce.productName())
  .attr('price', () => {
    const min = faker.number.float({ min: 10, max: 500, fractionDigits: 2 });
    const max =
      min + faker.number.float({ min: 0, max: 200, fractionDigits: 2 });
    return min === max
      ? `$${min.toFixed(2)}`
      : `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  })
  .attr('vendor', () => faker.company.name())
  .attr('type', () => faker.commerce.department())
  .attr('tags', () =>
    faker.helpers.arrayElements(
      [faker.commerce.productAdjective(), faker.commerce.productMaterial()],
      { min: 1, max: 3 }
    )
  )
  .attr('description', () => {
    const desc = faker.commerce.productDescription();
    return desc.length > 150 ? desc.substring(0, 147) + '...' : desc;
  })
  .attr('url', () => faker.internet.url())
  .attr('image', () => faker.helpers.maybe(() => faker.image.url()))
  .attr('reason', () =>
    faker.helpers.maybe(() =>
      faker.helpers.arrayElement([
        'Best match for your search',
        'Popular choice',
        'Great value',
        'Highly rated',
        'Recently added',
      ])
    )
  );
