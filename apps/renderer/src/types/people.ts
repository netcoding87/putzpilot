export type Person = {
  id?: number | string;
  guid?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: { name?: string } | string;
  statusId?: number | string;
  personStatus?: { id?: number | string; name?: string };
  age?: number;
  birthday?: string;
  birthdate?: string;
  householdId?: number | string;
  familyStatusId?: number | string;
  rels?: Relation[];
};

export type Relation = {
  id?: number | string;
  vater_id?: number | string;
  kind_id?: number | string;
  beziehungstyp_id?: number | string;
  name?: string;
  personAId?: number | string;
  personBId?: number | string;
  personId?: number | string;
  relativeId?: number | string;
  relationshipName?: string;
};

export type PersonStatus = {
  id?: number | string;
  name?: string;
  nameTranslated?: string;
};

export type StatusGroup = {
  label: string;
  labelTranslated: string;
  statusKey: string;
  persons: Person[];
};
