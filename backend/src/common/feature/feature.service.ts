import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Abstract base class for all generated feature services.
 *
 * Subclasses declare which Prisma models they own by passing the model names
 * to super(); the typed `model()` accessor then provides direct access to
 * the matching PrismaClient delegate without unsafe casts.
 *
 * Usage in a generated subclass:
 *
 *   @Injectable()
 *   export class ChannelsService extends FeatureService {
 *     constructor(prisma: PrismaService) {
 *       super(prisma, ['Channel', 'Message'] as const);
 *     }
 *   }
 *
 * Then inside a method:
 *
 *   const channel = await this.model('Channel').findUnique({ where: { id } });
 */
export abstract class FeatureService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly entities: readonly Prisma.ModelName[],
  ) {}

  /**
   * Return the Prisma delegate for the given model name with full type safety.
   *
   * The return type is `PrismaClient[Uncapitalize<M>]` which resolves to
   * the exact delegate type (e.g. `PrismaClient['channel']` for `'Channel'`),
   * giving you typed `findMany`, `create`, `update`, etc.
   */
  protected model<M extends Prisma.ModelName>(name: M): PrismaClient[Uncapitalize<M>] {
    // Prisma delegates live on PrismaClient under the uncapitalized model name.
    const key = (name.charAt(0).toLowerCase() + name.slice(1)) as Uncapitalize<M>;
    return (this.prisma as unknown as PrismaClient)[key] as PrismaClient[Uncapitalize<M>];
  }
}
