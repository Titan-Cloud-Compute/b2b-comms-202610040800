// InvoiceGeneration DTOs

export interface PostApiInvoicesRequestDto {
  orderId: string;
  amount: number;
}

export interface PostApiInvoicesResponseDto {
  id: string;
  orderId: string;
  amount: number;
}

export interface GetApiInvoicesIdDownloadRequestDto {
}

export interface GetApiInvoicesIdDownloadResponseDto {
  id: string;
  downloadUrl: string;
}
