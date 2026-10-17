import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi("orders");
  const db = await getDriver();

  const [ordersResult, customers, products] = await Promise.all([
    db.listOrders({ page: 1, pageSize: 1000 }),
    db.listCustomers({ page: 1, pageSize: 1 }),
    db.listProducts({ includeInactive: true, limit: 60 }),
  ]);

  const orders = ordersResult.items;
  const statusCounts = ORDER_STATUSES.reduce(
    (acc, status) => {
      acc[status] = orders.filter((o) => o.status === status).length;
      return acc;
    },
    {} as Record<OrderStatus, number>
  );

  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  return json({
    totals: {
      orders: ordersResult.total,
      customers: customers.total,
      products: products.items.length,
      revenue: Math.round(revenue * 100) / 100,
    },
    statusCounts,
    recentOrders: orders.slice(0, 8),
  });
});
