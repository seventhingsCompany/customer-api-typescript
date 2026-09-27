import { describe, expect, it } from 'vitest';
import { ApiError, Fields } from '../../src/index.js';
import { error, json, ok, setup } from './mock.js';

const ORDER = {
  id: 7,
  order_number: 'CH-7',
  created_at: 'c',
  user_id: null,
  total_price: 12.5,
  completed: false,
  cancelled: true,
  cancellation_reason: 'x',
  billing_data: {
    first_name: 'A',
    last_name: 'B',
    street: 'S',
    house_number: '1',
    zip_code: 'Z',
    city: 'C',
  },
  articles: [{ id: 1 }],
};

describe('circularityHub', () => {
  it('suggestCategory posts the filter object and returns the map', async () => {
    const { client, last } = setup(() => json({ 'o-1': 'Chairs' }));
    const res = await client.circularityHub.suggestCategory({
      filter: { status: { eq: 'active' } },
    });
    expect(res).toEqual({ 'o-1': 'Chairs' });
    expect(last().path).toBe('circularity-hub/suggest-category');
    expect(last().json()).toEqual({ filter: { status: { eq: 'active' } } });
  });

  it('suggestions return null for an empty [] response', async () => {
    const { client } = setup(() => json([]));
    expect(await client.circularityHub.suggestCategory({})).toBeNull();
    expect(await client.circularityHub.suggestRestPrice({ o: 'Chairs' })).toBeNull();
  });

  it('suggestRestPrice sends the category map', async () => {
    const { client, last } = setup(() => json({ o: '10.00' }));
    expect(await client.circularityHub.suggestRestPrice({ o: 'Chairs' })).toEqual({ o: '10.00' });
    expect(last().json()).toEqual({ o: 'Chairs' });
  });

  it('addObjects', async () => {
    const { client, last } = setup(() => ok());
    await client.circularityHub.addObjects({ o: { category: 'Chairs', price: '10' } });
    expect(last().path).toBe('circularity-hub/add-objects-to-circularity-hub');
    expect(last().json()).toEqual({ o: { category: 'Chairs', price: '10' } });
  });

  it('items CRUD uses numeric IDs', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'GET'
        ? json(req.path.endsWith('items') ? { items: [{ id: 1 }] } : { id: 1 })
        : ok(),
    );
    expect(await client.circularityHub.listItems({ page: 1 })).toEqual([{ id: 1 }]);
    expect(await client.circularityHub.getItem(1)).toEqual({ id: 1 });
    await client.circularityHub.updateItem(1, { price: '5' });
    await client.circularityHub.deleteItem(1);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET circularity-hub/items',
      'GET circularity-hub/item/1',
      'PATCH circularity-hub/item/1',
      'DELETE circularity-hub/item/1',
    ]);
  });

  it('allItems yields Fields across pages', async () => {
    const { client } = setup((req) =>
      json({ items: req.query.startsWith('page=1&') ? [{ id: 1, name: 'a' }] : [] }),
    );
    const out: Fields[] = [];
    for await (const item of client.circularityHub.allItems({ perPage: 1 })) out.push(item);
    expect(out.map((f) => f.int('id'))).toEqual([1]);
  });

  it('orders', async () => {
    const { client, calls } = setup((req) => {
      if (req.method === 'POST')
        return new Response(null, { status: 201, headers: { 'Location-Id': '42' } });
      if (req.method === 'PATCH') return ok();
      return json(req.path.endsWith('orders') ? { items: [ORDER] } : ORDER);
    });
    const [o] = await client.circularityHub.listOrders();
    expect(o).toEqual({
      id: 7,
      orderNumber: 'CH-7',
      createdAt: 'c',
      userId: null,
      totalPrice: 12.5,
      completed: false,
      cancelled: true,
      cancellationReason: 'x',
      billingData: {
        firstName: 'A',
        lastName: 'B',
        street: 'S',
        houseNumber: '1',
        zipCode: 'Z',
        city: 'C',
      },
      articles: [{ id: 1 }],
    });
    expect(await client.circularityHub.createOrder([1, 2])).toBe(42);
    expect(calls[1]?.json()).toEqual([1, 2]);
    expect((await client.circularityHub.getOrder(7)).billingData?.city).toBe('C');
    await client.circularityHub.updateOrder(7, { completed: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET circularity-hub/orders',
      'POST circularity-hub/orders',
      'GET circularity-hub/order/7',
      'PATCH circularity-hub/order/7',
    ]);
  });

  it('surfaces errors', async () => {
    const { client } = setup(() => error(500));
    await expect(client.circularityHub.suggestCategory({})).rejects.toBeInstanceOf(ApiError);
    await expect(client.circularityHub.getItem(1)).rejects.toBeInstanceOf(ApiError);
  });
});
