import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from "../../helper/index.js";

export class LoginDto {
    @Transform(({value}) => normalizeEmail(value))
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(1)
    password!: string;
}