/**
 * Unit tests for SharedChannelController and SharedChannelService.
 * Uses fake prisma delegates (jest.fn) — no real DB connection needed.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { SharedChannelController } from './shared-channel.controller';
import { SharedChannelService } from './shared-channel.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handler(name: string) {
  return (SharedChannelController.prototype as unknown as Record<string, unknown>)[name] as object;
}

// ---------------------------------------------------------------------------
// Fake Prisma
// ---------------------------------------------------------------------------

class FakePrisma {
  readonly vendorProfile = {
    findUnique: jest.fn(),
  };
  readonly channel = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  };
  readonly message = {
    create: jest.fn(),
  };
}

function makeService(fakePrisma: FakePrisma): SharedChannelService {
  return new SharedChannelService(fakePrisma as unknown as PrismaService);
}

function makeController(service: SharedChannelService): SharedChannelController {
  return new SharedChannelController(service);
}

function makeReq(userId: string, role: UserRole) {
  return { session: { userId, role } } as unknown as import('express').Request;
}

// ---------------------------------------------------------------------------
// Controller metadata tests
// ---------------------------------------------------------------------------

describe('SharedChannelController — route metadata', () => {
  it('mounts at api/channels', () => {
    // Controller-level path is on the class, not a method
    const path = Reflect.getMetadata(PATH_METADATA, SharedChannelController);
    expect(path).toBe('api/channels');
  });

  it('createChannel is POST /', () => {
    const h = handler('createChannel');
    // NestJS stores '/' for bare @Post()
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
  });

  it('listChannels is GET /', () => {
    const h = handler('listChannels');
    // NestJS stores '/' for bare @Get()
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.GET);
  });

  it('postMessage is POST :id/messages', () => {
    const h = handler('postMessage');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe(':id/messages');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
  });
});

// ---------------------------------------------------------------------------
// Service unit tests
// ---------------------------------------------------------------------------

describe('SharedChannelService.createChannel', () => {
  let fake: FakePrisma;
  let service: SharedChannelService;

  beforeEach(() => {
    fake = new FakePrisma();
    service = makeService(fake);
  });

  it('creates a channel tied to the vendor profile', async () => {
    const profile = { id: 'prof-1', userId: 'user-1' };
    fake.vendorProfile.findUnique.mockResolvedValue(profile);
    const created = { id: 'chan-1', name: 'Acme Channel', vendorId: profile.id, vendorProfileId: profile.id };
    fake.channel.create.mockResolvedValue(created);

    const result = await service.createChannel('user-1', 'Acme Channel');

    expect(fake.vendorProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(fake.channel.create).toHaveBeenCalledWith({
      data: { name: 'Acme Channel', vendorId: profile.id, vendorProfileId: profile.id },
    });
    expect(result).toEqual({ id: 'chan-1', name: 'Acme Channel' });
  });

  it('throws ConflictException when vendor has no profile', async () => {
    fake.vendorProfile.findUnique.mockResolvedValue(null);
    await expect(service.createChannel('user-no-profile', 'Chan')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(fake.channel.create).not.toHaveBeenCalled();
  });
});

describe('SharedChannelService.listChannels', () => {
  let fake: FakePrisma;
  let service: SharedChannelService;

  beforeEach(() => {
    fake = new FakePrisma();
    service = makeService(fake);
  });

  it('returns only vendor channels for VENDOR role', async () => {
    const profile = { id: 'prof-1', userId: 'user-v' };
    fake.vendorProfile.findUnique.mockResolvedValue(profile);
    fake.channel.findMany.mockResolvedValue([
      { id: 'chan-1', name: 'Chan A' },
    ]);

    const result = await service.listChannels('user-v', UserRole.VENDOR);

    expect(fake.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorProfileId: 'prof-1' } }),
    );
    expect(result).toEqual([{ id: 'chan-1', name: 'Chan A' }]);
  });

  it('returns empty array for VENDOR with no profile', async () => {
    fake.vendorProfile.findUnique.mockResolvedValue(null);
    const result = await service.listChannels('user-v', UserRole.VENDOR);
    expect(result).toEqual([]);
    expect(fake.channel.findMany).not.toHaveBeenCalled();
  });

  it('returns all channels for CUSTOMER role', async () => {
    fake.channel.findMany.mockResolvedValue([
      { id: 'chan-1', name: 'Chan A' },
      { id: 'chan-2', name: 'Chan B' },
    ]);

    const result = await service.listChannels('user-c', UserRole.CUSTOMER);

    expect(fake.vendorProfile.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'chan-1', name: 'Chan A' },
      { id: 'chan-2', name: 'Chan B' },
    ]);
  });

  it('returns all channels for ADMIN role', async () => {
    fake.channel.findMany.mockResolvedValue([{ id: 'chan-1', name: 'Chan A' }]);
    const result = await service.listChannels('user-a', UserRole.ADMIN);
    expect(result).toEqual([{ id: 'chan-1', name: 'Chan A' }]);
  });
});

describe('SharedChannelService.postMessage', () => {
  let fake: FakePrisma;
  let service: SharedChannelService;

  beforeEach(() => {
    fake = new FakePrisma();
    service = makeService(fake);
  });

  it('customer can post message — persists senderId and returns dto', async () => {
    const channel = { id: 'chan-1', name: 'Chan A', vendorProfileId: 'prof-1' };
    fake.channel.findUnique.mockResolvedValue(channel);
    const msg = { id: 'msg-1', body: 'Hello!', channelId: 'chan-1', senderId: 'user-c' };
    fake.message.create.mockResolvedValue(msg);

    const result = await service.postMessage('chan-1', 'user-c', UserRole.CUSTOMER, 'Hello!');

    expect(fake.message.create).toHaveBeenCalledWith({
      data: { body: 'Hello!', channelId: 'chan-1', senderId: 'user-c' },
    });
    expect(result).toEqual({ id: 'msg-1', body: 'Hello!', channelId: 'chan-1' });
  });

  it('throws NotFoundException for unknown channel', async () => {
    fake.channel.findUnique.mockResolvedValue(null);
    await expect(
      service.postMessage('no-such-chan', 'user-c', UserRole.CUSTOMER, 'Hi'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fake.message.create).not.toHaveBeenCalled();
  });

  it('vendor can post to their own channel', async () => {
    const profile = { id: 'prof-1', userId: 'user-v' };
    const channel = { id: 'chan-1', name: 'Chan A', vendorProfileId: 'prof-1' };
    fake.channel.findUnique.mockResolvedValue(channel);
    fake.vendorProfile.findUnique.mockResolvedValue(profile);
    const msg = { id: 'msg-2', body: 'Vendor reply', channelId: 'chan-1', senderId: 'user-v' };
    fake.message.create.mockResolvedValue(msg);

    const result = await service.postMessage('chan-1', 'user-v', UserRole.VENDOR, 'Vendor reply');
    expect(result).toEqual({ id: 'msg-2', body: 'Vendor reply', channelId: 'chan-1' });
  });

  it('throws ForbiddenException when vendor posts to another vendor channel', async () => {
    const channel = { id: 'chan-other', name: 'Other Chan', vendorProfileId: 'prof-other' };
    fake.channel.findUnique.mockResolvedValue(channel);
    fake.vendorProfile.findUnique.mockResolvedValue({ id: 'prof-mine', userId: 'user-v' });

    await expect(
      service.postMessage('chan-other', 'user-v', UserRole.VENDOR, 'Hey'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fake.message.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Controller integration — validates body with zod
// ---------------------------------------------------------------------------

describe('SharedChannelController — body validation', () => {
  let fake: FakePrisma;
  let controller: SharedChannelController;

  beforeEach(() => {
    fake = new FakePrisma();
    const service = makeService(fake);
    controller = makeController(service);
  });

  it('createChannel throws BadRequestException for empty name', async () => {
    fake.vendorProfile.findUnique.mockResolvedValue({ id: 'p1' });
    const req = makeReq('user-v', UserRole.VENDOR);
    await expect(controller.createChannel({ name: '' }, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fake.channel.create).not.toHaveBeenCalled();
  });

  it('postMessage throws BadRequestException for empty body', async () => {
    fake.channel.findUnique.mockResolvedValue({ id: 'chan-1', vendorProfileId: 'p1' });
    const req = makeReq('user-c', UserRole.CUSTOMER);
    await expect(controller.postMessage('chan-1', { body: '' }, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fake.message.create).not.toHaveBeenCalled();
  });
});
