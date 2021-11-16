# Basewar - WebSocket Documentation

Le endpoint pour se connecter en WebSocket est le suivant :

```
ws://http://basewar.herokuapp.com/api/
```



## Réception de messages



### Rafraichissement de la position des utilisateurs

Le serveur a la possibilité de recevoir un message au format JSON permettant d'une part d'identifier l'utilisateur et d'autre part d'actualiser sa position.

Le message doit contenir :

- Une propriété "command" contenant la valeur "updateLocation".

- Une propriété "userId" contenant l'identifiant de l'utilisateur.
- Une propriété "location" contenant un point géographique au format GeoJSON.



Exemple :

```json
{
    "command": "updateLocation",
    "userId": "6193ee61a4560940f6904b5d",
    "location": {
        "type": "Point",
        "coordinates": [
            -73.856077,
            40.848447
        ]
    }
}
```



#### Gestion des erreurs

Dans le cas où une erreur devait survenir, l'utilisateur recevra un message d'erreur.

Celui-ci contient :

- Une propriété "command" contenant la valeur "error".
- Une propriété "params" contenant le message d'erreur.



1. Si l'utilisateur envoie un identifiant qui ne correspond à aucun utilisateur dans la base de donnée, un message d'erreur lui sera envoyé.

   Exemple :

   ```json
   {
       "command": "error",
       "params": {
           "message": "This userId does not correspond to any user."
       }
   }
   ```

   

2. Si l'utilisateur envoie un identifiant qui ne correspond pas à un ObjectID, un message d'erreur lui sera envoyé.

   Exemple : 

   ```json
   {
       "command": "error",
       "params": {
           "message": "Cast to ObjectId failed for value \"6193ee61a4560940f69045d\" (type string) at path \"_id\" for model \"User\""
       }
   }
   ```

   

3.  Si l'utilisateur envoie une localisation dont la propriété "type" n'est pas "Point", un message d'erreur lui sera envoyé.

   Exemple :

   ```json
   {
       "command": "error",
       "params": {
           "message": "Invalid location type"
       }
   }
   ```

   

4.  Si l'utilisateur envoie une localisation dont la propriété "coordinates" ne sont pas des coordonnées GeoJSON valides, un message d'erreur lui sera envoyé.


   Exemple : 

   ```json
   {
       "command": "error",
       "params": {
           "message": "Invalid location coordinates"
       }
   }
   ```





## Envoi de messages



### Rafraichissement des propriétés d'un utilisateur

Tant qu'un utilisateur est a proximité d'une base, il reçoit toutes les secondes un message au format JSON lui indiquant des informations concernant son argent ainsi que l'argent qu'il gagne par seconde.

Le message contient :

- Une propriété "command" contenant la valeur "updateUser".
- Une propriété "params" contenant l'argent actuel de l'utilisateur et l'argent qu'il reçoit par seconde.



Exemple :

```json
{
    "command": "updateUser",
    "params": {
        "money": 2,
        "income": 1
    }
}
```



### Notification au propriétaire d'une base lors de l'arrivée d'un autre utilisateur à proximité

Lorsqu'un utilisateur n'étant pas le propriétaire d'une base arrive à proximité de la base, le propriétaire reçoit une fois un message l'en lui informant.

Le message contient :

- Une propriété "command" contenant la valeur "notification".
- Une propriété "params" contenant une propriété "baseId" pour l'identifiant de la base en question et une propriété "baseName" pour le nom de celle-ci.



Exemple :

```json
{
    "command": "notification",
    "params": {
        "baseId": "6193e3ac60ff57ccf667b828",
        "baseName": "Basabob"
    }
}
```

