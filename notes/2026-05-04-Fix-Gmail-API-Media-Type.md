# Fix Gmail API — Media Type 'application/json' is not supported

**Date** : 2026-05-04  
**Auteur** : Cline (DevOps Expert)  
**Contexte** : Erreur 400 INVALID_ARGUMENT lors de l'envoi de mail via utilisateur Google

---

## 🔍 Diagnostic

### Symptôme
```
Gmail API error (400): {
  "error": {
    "code": 400,
    "message": "Media type 'application/json' is not supported.",
    "errors": [{
      "message": "Media type 'application/json' is not supported.",
      "domain": "global",
      "reason": "badRequest"
    }],
    "status": "INVALID_ARGUMENT"
  }
}
```

Stack trace :
```
at attemptSend (/app/src/gmail-client.js:124:21)
at async Object.sendEmail (/app/src/gmail-client.js:134:20)
at async sendEmailViaProvider (/app/server.js:457:20)
```

### Cause racine

**Double problème dans `src/gmail-client.js`** :

1. **Mauvais endpoint Gmail API utilisé** :
   - ❌ `POST https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart`
   - ✅ `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
   
   L'endpoint `/upload/...` est conçu pour l'upload média en deux parties (metadata JSON + contenu binaire). Il n'accepte pas un body JSON simple.

2. **Utilisation de FormData + Blob** (APIs Web non stables en Node.js) :
   - `FormData` et `Blob` natifs ne sont pas disponibles dans toutes les versions de Node.js
   - Le `Content-Type` généré (`multipart/form-data`) ne correspond pas aux attentes de Gmail API
   - Une seule partie était envoyée (metadata JSON) au lieu des deux requises

---

## ✅ Solution appliquée

### Modifications dans `src/gmail-client.js`

**Ligne 14** — Changement de l'URL :
```diff
- const GMAIL_API_URL = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send';
+ const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
```

**Lignes 108-115** — Remplacement du body FormData par un JSON simple :
```diff
- const formData = new FormData();
- const metadata = JSON.stringify({ raw: rawBase64Url });
- const metadataBlob = new Blob([metadata], { type: 'application/json' });
- formData.append('metadata', metadataBlob);
- const response = await fetch(`${GMAIL_API_URL}?uploadType=multipart`, {
-   method: 'POST',
-   headers: { Authorization: `Bearer ${token}` },
-   body: formData,
- });
+ const response = await fetch(GMAIL_API_URL, {
+   method: 'POST',
+   headers: {
+     Authorization: `Bearer ${token}`,
+     'Content-Type': 'application/json',
+   },
+   body: JSON.stringify({ raw: rawBase64Url }),
+ });
```

### Justification

- Le message MIME est déjà entièrement construit (pièce jointe incluse) via `buildMimeMessage()`
- L'endpoint standard `/messages/send` accepte un body JSON avec le champ `raw` (message MIME en base64url)
- Limite de 35 Mo — largement suffisante pour des emails avec pièces jointes PDF
- Supprime la dépendance fragile à `FormData`/`Blob` dans Node.js

---

## 📁 Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/gmail-client.js` | Ligne 14 (URL) + Lignes 108-120 (attemptSend) |

**Aucune autre dépendance touchée** : `server.js`, `src/auth.js`, mécanisme de refresh token inchangés.

---

## 🧪 Plan de validation

1. **Envoi unitaire** : `POST /api/send/:id` avec un contact de test
2. **Pièce jointe** : Vérifier que le PDF est bien présent dans le mail reçu
3. **Refresh token** : Forcer l'expiration du token (ou simuler un 401) pour valider le retry automatique
4. **Envoi groupé** : `POST /api/send-all` sur plusieurs contacts

---

## État actuel

- [x] Fix appliqué dans `src/gmail-client.js`
- [x] Graphe mis à jour (`graphify update` → 79 nodes, 152 edges)
- [ ] Tests de validation à effectuer en production