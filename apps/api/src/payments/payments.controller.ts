import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { ALLOWED_FILE_TYPES } from '../files/file-type.js';
import { MAX_PROOF_FILE_SIZE } from './payments.constants.js';
import { PaymentsService } from './payments.service.js';

export interface UploadedProof {
  buffer: Buffer;
  originalname: string;
  size: number;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RequirePermission('payments.create')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(dto, user.id);
  }

  @RequirePermission('payments.read')
  @Get()
  list(@Query() query: ListPaymentsQueryDto) {
    return this.payments.list(query);
  }

  @RequirePermission('payments.create')
  @Post(':id/proof')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROOF_FILE_SIZE, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_FILE_TYPES.some((t) => t.mime === file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only png, jpg, webp and pdf files are allowed'), false);
      },
    }),
  )
  attachProof(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedProof | undefined,
  ) {
    return this.payments.attachProof(id, file, user.id);
  }

  @RequirePermission('payments.read')
  @Get(':id/proof')
  @Header('Cache-Control', 'private, no-store')
  async proof(@Param('id', ParseUUIDPipe) id: string) {
    const { stream, mimeType, fileName } = await this.payments.openProof(id);
    return new StreamableFile(stream, { type: mimeType, disposition: `inline; filename="${fileName}"` });
  }
}
