# Graph Report - Automatisation MAIL  (2026-05-04)

## Corpus Check
- 11 files · ~22,423 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 79 nodes · 152 edges · 8 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `api()` - 11 edges
2. `showToast()` - 10 edges
3. `loadContacts()` - 9 edges
4. `handleBatchSend()` - 9 edges
5. `sendEmail()` - 9 edges
6. `renderContacts()` - 8 edges
7. `handleBatchPending()` - 8 edges
8. `authenticate()` - 8 edges
9. `exitSelectMode()` - 7 edges
10. `handleBatchDelete()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `sendEmailViaProvider()` --calls--> `sendEmail()`  [INFERRED]
  server.js → src/zimbra-client.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.24
Nodes (19): addBatchLog(), api(), closeBatchModal(), closeModal(), exitSelectMode(), handleBatchConfirm(), handleBatchDelete(), handleBatchPending() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.27
Nodes (12): authenticate(), buildEnvelope(), escapeXml(), mimeEncodeHeader(), parseAttachmentId(), parseAuthToken(), parseLifetime(), parseSoapFault() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.28
Nodes (3): loadDocuments(), renderDocuments(), uploadDocuments()

### Community 3 - "Community 3"
Cohesion: 0.52
Nodes (6): base64urlEncode(), buildMimeMessage(), generateBoundary(), getRefreshGoogleToken(), mimeEncodeHeader(), sendEmail()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (1): sendEmailViaProvider()

### Community 5 - "Community 5"
Cohesion: 0.6
Nodes (5): getFilteredContacts(), renderContactSelection(), selectAllContacts(), toggleSelectContact(), updateBatchUI()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): checkAuth(), handleLogout(), init(), showLoginSection()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): getInitials(), openModal(), showAppSection()

## Knowledge Gaps
- **Thin community `Community 4`** (6 nodes): `generateEmail()`, `getCookie()`, `getUserForSend()`, `logError()`, `sendEmailViaProvider()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sendEmail()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `sendEmailViaProvider()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._