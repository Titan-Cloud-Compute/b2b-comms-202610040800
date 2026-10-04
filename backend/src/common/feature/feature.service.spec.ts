import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FeatureService } from './feature.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Minimal fake PrismaService for unit tests — no DB connection needed
// ---------------------------------------------------------------------------

class FakePrismaService {
  // Minimal delegate fakes to satisfy the type check.
  // We only expose the models the test subclass declares.
  readonly user = { findUnique: jest.fn() };
}

// ---------------------------------------------------------------------------
// Concrete subclass that exercises the base constructor and model() accessor
// ---------------------------------------------------------------------------

@Injectable()
class UserFeatureService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['User'] as const);
  }

  getEntities(): readonly Prisma.ModelName[] {
    return this.entities;
  }

  userDelegate() {
    return this.model('User');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeatureService', () => {
  let fakePrisma: FakePrismaService;
  let service: UserFeatureService;

  beforeEach(() => {
    fakePrisma = new FakePrismaService();
    service = new UserFeatureService(fakePrisma as unknown as PrismaService);
  });

  it('should store the injected prisma instance', () => {
    // Accessing the protected field via the subclass proxy above
    expect((service as unknown as { prisma: unknown }).prisma).toBe(fakePrisma);
  });

  it('should store the declared entity names', () => {
    expect(service.getEntities()).toEqual(['User']);
  });

  it("model('User') returns prisma.user", () => {
    expect(service.userDelegate()).toBe(fakePrisma.user);
  });
});
