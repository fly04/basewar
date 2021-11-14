# Basewar

REST API project made with Express and MongoDB

## Links

https://github.com/MediaComem/comem-archioweb

## Routes

Users

```http
GET api/users
GET api/users/:id
POST api/users/
DELETE api/users/:id
PUT api/users/:id
```

Bases

```http
GET api/bases
GET api/bases?userId=
GET api/bases/:id

POST api/bases/
DELETE api/bases/:id
PUT api/bases/:id
```

Investments

```http
POST api/bases/:id/investments
GET api/bases/:id/investments
GET api/bases/:id/investments/:investmentId
DELETE api/bases/:id/investments/:investmentId
```