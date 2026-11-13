import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';

type ModuleReference =
  | Function
  | {
      module?: Function;
      imports?: ModuleReference[];
      controllers?: Function[];
      forwardRef?: () => ModuleReference;
    };

function getRegisteredControllers(rootModule: Function): Function[] {
  const visited = new Set<Function>();
  const controllers = new Set<Function>();

  const visit = (reference: ModuleReference): void => {
    if (
      typeof reference === 'object' &&
      reference !== null &&
      reference.forwardRef
    ) {
      visit(reference.forwardRef());
      return;
    }

    const moduleType =
      typeof reference === 'function' ? reference : reference.module;
    if (!moduleType || visited.has(moduleType)) return;
    visited.add(moduleType);

    const dynamicControllers =
      typeof reference === 'object' && reference !== null
        ? (reference.controllers ?? [])
        : [];
    for (const controller of [
      ...(Reflect.getMetadata('controllers', moduleType) ?? []),
      ...dynamicControllers,
    ]) {
      controllers.add(controller);
    }

    const dynamicImports =
      typeof reference === 'object' && reference !== null
        ? (reference.imports ?? [])
        : [];
    const imports = [
      ...(Reflect.getMetadata('imports', moduleType) ?? []),
      ...dynamicImports,
    ] as ModuleReference[];
    imports.forEach(visit);
  };

  visit(rootModule);
  return [...controllers];
}

const httpVerbs = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const normalizePath = (path: string): string =>
  path.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/+/g, '/');

describe('OpenAPI contract', () => {
  let app: INestApplication;
  let document: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const controllers = getRegisteredControllers(AppModule);
    const moduleRef = await Test.createTestingModule({ controllers })
      .useMocker(() => ({}))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('API UTH Online Judge')
        .setDescription('Tài liệu các API của hệ thống UTH Online Judge.')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth('uth_refresh_token', { type: 'apiKey', in: 'cookie' })
        .build(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('matches registered controller method/path pairs without duplicates', () => {
    const stack = app.getHttpAdapter().getInstance().router.stack as Array<{
      route?: { path: string | string[]; methods: Record<string, boolean> };
    }>;
    const registered = stack.flatMap((layer) => {
      if (!layer.route) return [];
      const paths = Array.isArray(layer.route.path)
        ? layer.route.path
        : [layer.route.path];
      return paths.flatMap((path) =>
        Object.entries(layer.route!.methods)
          .filter(([method, enabled]) => enabled && httpVerbs.includes(method))
          .map(([method]) => `${method.toUpperCase()} ${normalizePath(path)}`),
      );
    });
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => httpVerbs.includes(method))
        .map(([method]) => `${method.toUpperCase()} ${normalizePath(path)}`),
    );

    expect(new Set(registered).size).toBe(registered.length);
    expect(new Set(operations).size).toBe(operations.length);
    expect(registered).toHaveLength(176);
    expect(registered).toContain('GET /admin/dashboard/statistics');
    expect(registered).toContain('POST /ai-assistant/chat');
    expect([...operations].sort()).toEqual([...registered].sort());

    for (const [path, item] of Object.entries(document.paths)) {
      const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map(
        (match) => match[1],
      );
      for (const [method, operation] of Object.entries(item)) {
        if (!httpVerbs.includes(method)) continue;
        const parameterNames = (operation.parameters ?? []).flatMap(
          (parameter) =>
            'name' in parameter && 'in' in parameter && parameter.in === 'path'
              ? [parameter.name]
              : [],
        );
        expect(parameterNames, `${method.toUpperCase()} ${path}`).toEqual(
          expect.arrayContaining(pathParameters),
        );
      }
    }
  });

  it('documents every operation with Vietnamese summary, description, and tag', () => {
    const vietnamese =
      /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
    for (const [path, item] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (!httpVerbs.includes(method)) continue;
        expect(
          Object.keys(operation.responses ?? {}).length,
          `${method.toUpperCase()} ${path}`,
        ).toBeGreaterThan(0);
        expect(operation.summary, `${method.toUpperCase()} ${path}`).toMatch(
          vietnamese,
        );
        expect(
          operation.description,
          `${method.toUpperCase()} ${path}`,
        ).toMatch(vietnamese);
        expect(
          operation.description,
          `${method.toUpperCase()} ${path}`,
        ).not.toContain('******');
        expect(
          operation.tags?.length,
          `${method.toUpperCase()} ${path}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('documents Organization leaderboard scope and access conditions', () => {
    const description =
      document.paths['/organizations/{slug}/leaderboard']?.get?.description ??
      '';
    expect(description).toContain('thành viên hiện tại');
    expect(description).toContain('sau khi contest kết thúc');
    expect(description).toContain('Global Contest không được tính');
    expect(description).toContain('Organization ACTIVE cho phép xem công khai');
    expect(description).toContain('Organization ARCHIVED chỉ System Admin');
    expect(description).toContain('không chứa source code');
  });

  it('distinguishes bearer, optional, cookie-only, and public access', () => {
    expect(document.paths['/admin/dashboard']?.get?.security).toContainEqual({
      bearer: [],
    });
    expect(document.paths['/problems']?.get?.security).toBeUndefined();
    expect(document.paths['/news']?.get?.security).toBeUndefined();
    expect(document.paths['/news/media/{id}']?.get?.security).toBeUndefined();
    expect(document.paths['/admin/news/media']?.post?.security).toContainEqual({
      bearer: [],
    });
    expect(
      document.paths['/admin/news/media/{id}']?.get?.security,
    ).toContainEqual({ bearer: [] });
    expect(document.paths['/auth/refresh']?.post?.security).toContainEqual({
      uth_refresh_token: [],
    });
    expect(document.paths['/auth/refresh']?.post?.security).not.toContainEqual({
      bearer: [],
    });
    expect(document.paths['/auth/logout']?.post?.security).toBeUndefined();
    expect(document.paths['/auth/me/change-password']?.post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/ai-assistant/chat']?.post?.security).toEqual([
      { bearer: [] },
      {},
    ]);
  });

  it('reflects the controller HTTP status codes', () => {
    expect(document.paths['/auth/register']?.post?.responses).toHaveProperty(
      '201',
    );
    expect(
      document.paths['/demo-queue/uppercase']?.post?.responses,
    ).toHaveProperty('202');
    expect(
      document.paths['/auth/me/change-password']?.post?.responses,
    ).toHaveProperty('204');
    expect(
      document.paths['/admin/problems/illustrations']?.post?.responses,
    ).toHaveProperty('201');
    expect(
      document.paths['/organizations/{slug}/contests/{contestId}/publish']?.post
        ?.responses,
    ).toHaveProperty('200');
    expect(
      document.paths['/ai-assistant/chat']?.post?.responses,
    ).toHaveProperty('200');
    expect(
      document.paths['/ai-assistant/chat']?.post?.responses,
    ).not.toHaveProperty('201');
  });

  it('exposes DTO properties and multipart file schemas', () => {
    expect(document.info).toMatchObject({
      title: 'API UTH Online Judge',
      description: expect.stringContaining('Tài liệu'),
    });
    expect(document.components?.schemas?.CreateSubmissionDto).toMatchObject({
      required: ['problemCode', 'language', 'sourceCode'],
      properties: {
        problemCode: { type: 'string' },
        language: { type: 'string' },
        sourceCode: { type: 'string' },
      },
    });
    expect(document.components?.schemas?.AdminProblemDto).toMatchObject({
      required: expect.arrayContaining([
        'code',
        'title',
        'statement',
        'tags',
        'languages',
        'timeLimitSeconds',
        'memoryLimitMb',
      ]),
      properties: {
        testCases: { type: 'array' },
        editorials: { type: 'array' },
      },
    });
    expect(document.paths['/auth/google']?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'mode', in: 'query' }),
        expect.objectContaining({ name: 'rememberLogin', in: 'query' }),
      ]),
    );
    expect(
      document.paths['/auth/register']?.post?.requestBody?.content?.[
        'application/json'
      ]?.examples?.example,
    ).toMatchObject({
      value: {
        username: 'example_student',
        email: 'student@example.com',
        password: 'ExamplePass123!',
      },
    });
    expect(
      document.paths['/submissions']?.post?.responses?.['201']?.content?.[
        'application/json'
      ]?.schema,
    ).toMatchObject({
      example: {
        id: '00000000-0000-4000-8000-000000000000',
        status: 'QUEUED',
      },
    });
    expect(
      document.paths['/organizations/{slug}/contests']?.post?.requestBody
        ?.content?.['application/json']?.examples?.example?.value,
    ).toMatchObject({
      slug: 'algorithm-challenge-example',
      visibility: 'PRIVATE',
    });
    expect(
      document.paths['/organizations/{slug}/problems']?.post?.requestBody
        ?.content?.['application/json']?.examples?.example?.value,
    ).toMatchObject({
      code: 'problem_code',
      timeLimitSeconds: 1,
      memoryLimitMb: 256,
    });
    expect(
      document.paths['/organizations/{slug}/leaderboard']?.get?.responses?.[
        '200'
      ]?.content?.['application/json']?.schema,
    ).toMatchObject({
      example: {
        items: [
          {
            userId: '00000000-0000-4000-8000-000000000000',
            username: 'example_student',
          },
        ],
        page: 1,
        pageSize: 20,
      },
    });
    expect(
      document.paths['/organizations/{slug}/leaderboard']?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'page',
          in: 'query',
          schema: expect.objectContaining({ type: 'number' }),
        }),
        expect.objectContaining({
          name: 'pageSize',
          in: 'query',
          schema: expect.objectContaining({ type: 'number' }),
        }),
      ]),
    );
    expect(document.paths['/auth/me/avatar']?.post?.requestBody).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            properties: { avatar: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
    expect(document.paths['/auth/me/cover']?.post?.requestBody).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            properties: {
              cover: { type: 'string', format: 'binary' },
              crop: { type: 'string' },
            },
          },
        },
      },
    });
    expect(
      document.paths['/admin/problems/illustrations']?.post?.requestBody,
    ).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            properties: { image: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
    expect(
      document.paths['/admin/news/media']?.post?.requestBody,
    ).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            properties: { image: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
  });
});
