import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { ProductCategoriesController } from './product-categories.controller.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductsController, ProductCategoriesController],
  providers: [ProductsService],
})
export class ProductsModule {}
