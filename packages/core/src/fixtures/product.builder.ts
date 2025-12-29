import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import { z } from 'zod';
import { NormalizedProductSchema } from '../lib/types';

type NormalizedProduct = z.infer<typeof NormalizedProductSchema>;

/**
 * Builds doc_text matching the format used in normalizeShopifyProduct:
 * title + description + vendor + product_type + tags, all lowercased
 */
const buildDocText = (params: {
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
}): string =>
  [
    params.title,
    params.description,
    params.vendor,
    params.productType,
    params.tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const ProductBuilder = Factory.define<NormalizedProduct>('Product')
  .attr('id', () => faker.number.int({ min: 1, max: 999999 }))
  .attr('title', () => faker.commerce.productName())
  .attr('url', () => faker.internet.url())
  .attr('vendor', () => faker.company.name())
  .attr('product_type', () => faker.commerce.department())
  .attr('tags', () =>
    faker.helpers.arrayElements(
      [
        faker.commerce.productAdjective(),
        faker.commerce.productMaterial(),
        faker.word.noun(),
        faker.commerce.product(),
        faker.word.adjective(),
      ],
      { min: 1, max: 5 }
    )
  )
  .attr('available', () => faker.datatype.boolean({ probability: 0.8 }))
  .attr('price_min', () =>
    faker.number.float({ min: 10, max: 500, fractionDigits: 2 })
  )
  .attr(
    'price_max',
    ['price_min'],
    (priceMin: number) =>
      priceMin + faker.number.float({ min: 0, max: 200, fractionDigits: 2 })
  )
  .attr('images', () => [
    {
      src: faker.image.url(),
      alt: faker.commerce.productDescription(),
    },
  ])
  .attr('description_text', () => faker.commerce.productDescription())
  .attr(
    'doc_text',
    ['title', 'description_text', 'vendor', 'product_type', 'tags'],
    (
      title: string,
      description: string,
      vendor: string,
      productType: string,
      tags: string[]
      // eslint-disable-next-line max-params
    ) => buildDocText({ title, description, vendor, productType, tags })
  )
  .attr('variants', () => {
    const count = faker.number.int({ min: 0, max: 3 });
    return Array.from({ length: count }, () => ({
      sku: faker.string.alphanumeric(8).toUpperCase(),
      price: faker.number.float({ min: 10, max: 600, fractionDigits: 2 }),
      available: faker.datatype.boolean({ probability: 0.9 }),
      title: faker.commerce.productName(),
    }));
  })
  .attr('attributes', () => ({
    material: faker.commerce.productMaterial(),
    weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 }),
    dimensions: `${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })}`,
    color: faker.color.human(),
  }))
  .attr('embedding', () =>
    faker.helpers.maybe(
      () =>
        Array.from({ length: 1536 }, () =>
          faker.number.float({ min: -1, max: 1, fractionDigits: 6 })
        ),
      { probability: 0.3 }
    )
  );
