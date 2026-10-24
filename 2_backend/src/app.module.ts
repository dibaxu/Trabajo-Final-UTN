import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CostsModule } from './modules/costs/costs.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SalesModule } from './modules/sales/sales.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AuthModule,
    ProductsModule,
    CostsModule,
    InventoryModule,
    SalesModule,
    ExpensesModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
