// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import * as bodyParser from 'body-parser';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, {
//     cors: true,
//   });
//   // app.setGlobalPrefix("api")

//   app.use(bodyParser.json({ limit: '50mb' }));
//   app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
//   app.enableCors();
// app.useGlobalPipes(
//   new ValidationPipe({
//     whitelist: true,
//     transform: true,
//     transformOptions: { enableImplicitConversion: true },
//   }),
// );
//   await app.listen(process.env.PORT ?? 6000);
// }
// bootstrap();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  // Increase payload size
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Explicit CORS setup
  app.enableCors({
    origin: [
      'https://cn-squad.vercel.app',
      'https://cnsquad-admin-frontend.vercel.app',
      'https://cnsquad-frontend.vercel.app',
      'https://cnsquad-admin-frontend-prod.vercel.app',
      'https://admin-cnsquad.connectnigeria.com',
      'https://cnsq.connectnigeria.com',
      'http://10.161.5.213:3000',
      'http://localhost:3000', // frontend dev server
      'http://localhost:3001',
      'http://10.161.5.213:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // app.useGlobalFilters(new AllExceptionsFilter()); // Moved to AppModule for DI
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips out unknown fields
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('CN Squad API')
    .setDescription('The CN Squad API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));

  await app.listen(process.env.PORT ?? 4100, '0.0.0.0');
}
bootstrap();
