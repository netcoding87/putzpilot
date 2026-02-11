import { http, HttpResponse } from 'msw';

const persons = [
  {
    id: 1,
    firstName: 'Anna',
    lastName: 'Meyer',
    personStatus: { name: 'status.member' },
    birthdate: '1990-01-01',
  },
  {
    id: 2,
    firstName: 'Ben',
    lastName: 'Alt',
    personStatus: { name: 'status.member' },
    birthdate: '1950-01-01',
  },
  {
    id: 3,
    firstName: 'Clara',
    lastName: 'Schmidt',
    personStatus: { name: 'status.guest' },
    birthdate: '1995-05-05',
  },
];

const statuses = [
  { id: 1, name: 'status.member' },
  { id: 2, name: 'status.guest' },
];

export const handlers = [
  http.post('*/api/login', () => {
    return HttpResponse.json({ success: true }, { status: 200 });
  }),
  http.get('*/api/persons', () => {
    return HttpResponse.json({ data: persons, statuses }, { status: 200 });
  }),
];
