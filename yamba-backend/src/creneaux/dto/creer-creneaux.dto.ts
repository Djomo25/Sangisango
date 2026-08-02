export interface CreneauInputDto {
  dateHeure: string;
  dureeMinutes?: number;
}

export interface CreerCreneauxDto {
  creneaux: CreneauInputDto[];
}
