// OrderManagement DTOs

export interface PostApiOrdersRequestDto {
  vendorId: string;
}

export interface PostApiOrdersResponseDto {
  id: string;
  status: string;
  customerId: string;
}

export interface PatchApiOrdersIdConfirmRequestDto {
  estimatedDelivery: string;
}

export interface PatchApiOrdersIdConfirmResponseDto {
  id: string;
  status: string;
}

export interface GetApiOrdersRequestDto {
}

export interface GetApiOrdersResponseDto {
  id: string;
  status: string;
}
