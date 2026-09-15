import { IsOptional, IsString, MinLength } from 'class-validator'

// El administrador da de alta un miembro de repertorio: no tiene cuenta
// (no inicia sesion), solo un nombre y opcionalmente un instrumento por
// defecto para asignarlo rapido a los servicios.
export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  fullName!: string

  @IsOptional()
  @IsString()
  instrument?: string
}
