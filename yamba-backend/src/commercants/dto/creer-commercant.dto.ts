import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

const TONS_VALIDES = ['chaleureux', 'professionnel', 'direct'] as const;

export class CreerCommercantDto {
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsString()
  @IsNotEmpty()
  secteur!: string;

  @IsString()
  @IsNotEmpty()
  commune!: string;

  @IsString()
  @IsNotEmpty()
  telephone!: string;

  @IsOptional()
  @IsIn(TONS_VALIDES)
  tonAssistant?: (typeof TONS_VALIDES)[number];

  @IsOptional()
  @IsObject()
  horaires?: Record<string, string>;

  @IsOptional()
  @IsArray()
  servicesJson?: unknown[];

  @IsOptional()
  @IsArray()
  faqJson?: unknown[];
}
