import { Matches } from 'class-validator';
import { YMD } from './create-series.dto.js';

export class EndSeriesDto {
  @Matches(YMD)
  endsOn!: string;
}
