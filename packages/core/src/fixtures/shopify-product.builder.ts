import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import { z } from 'zod';
import { ShopifyProductSchema } from '../lib/types';

type ShopifyProduct = z.infer<typeof ShopifyProductSchema>;

const createVariantOptions = () => ({
  option1: faker.commerce.productMaterial(),
  option2: faker.helpers.maybe(() => faker.color.human()),
  option3: null,
});

const createVariantMeasurements = () => ({
  grams: faker.number.int({ min: 100, max: 5000 }),
  weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 1 }),
  weight_unit: 'kg',
});

const createShopifyVariant = (productId: number) => ({
  id: faker.number.int({ min: 1, max: 999999 }),
  product_id: productId,
  title: faker.commerce.productName(),
  price: faker.number
    .float({ min: 10, max: 500, fractionDigits: 2 })
    .toString(),
  sku: faker.string.alphanumeric(8).toUpperCase(),
  position: faker.number.int({ min: 1, max: 10 }),
  compare_at_price: faker.helpers.maybe(() =>
    faker.number.float({ min: 20, max: 600, fractionDigits: 2 }).toString()
  ),
  fulfillment_service: 'manual',
  inventory_management: 'shopify',
  ...createVariantOptions(),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  taxable: faker.datatype.boolean(),
  barcode: faker.string.numeric(12),
  ...createVariantMeasurements(),
  image_id: faker.helpers.maybe(() =>
    faker.number.int({ min: 1, max: 999999 })
  ),
  requires_shipping: faker.datatype.boolean({ probability: 0.9 }),
  price_currency: 'USD',
  compare_at_price_currency: 'USD',
});

const createShopifyImage = (productId: number) => ({
  id: faker.number.int({ min: 1, max: 999999 }),
  product_id: productId,
  position: faker.number.int({ min: 1, max: 10 }),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  alt: faker.commerce.productDescription(),
  width: faker.number.int({ min: 200, max: 2000 }),
  height: faker.number.int({ min: 200, max: 2000 }),
  src: faker.image.url(),
  variant_ids: [],
});

export const ShopifyProductBuilder = Factory.define<ShopifyProduct>(
  'ShopifyProduct'
)
  .attr('id', () => faker.number.int({ min: 1, max: 999999 }))
  .attr('title', () => faker.commerce.productName())
  .attr('body_html', () => `<p>${faker.commerce.productDescription()}</p>`)
  .attr('vendor', () => faker.company.name())
  .attr('product_type', () => faker.commerce.department())
  .attr('created_at', () => faker.date.past().toISOString())
  .attr('handle', ['title'], (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
  )
  .attr('updated_at', () => faker.date.recent().toISOString())
  .attr('published_at', () => faker.date.past().toISOString())
  .attr('tags', () =>
    faker.helpers
      .arrayElements(
        [
          faker.commerce.productAdjective(),
          faker.commerce.productMaterial(),
          faker.word.noun(),
        ],
        { min: 1, max: 5 }
      )
      .join(', ')
  )
  .attr('variants', ['id'], (productId: number) => {
    const count = faker.number.int({ min: 1, max: 3 });
    return Array.from({ length: count }, () => createShopifyVariant(productId));
  })
  .attr('images', ['id'], (productId: number) => {
    const shouldCreate = faker.datatype.boolean({ probability: 0.8 });
    if (!shouldCreate) return undefined;
    const count = faker.number.int({ min: 1, max: 5 });
    return Array.from({ length: count }, () => createShopifyImage(productId));
  });
