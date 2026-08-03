# Graph Report - IMPETUS  (2026-08-01)

## Corpus Check
- 15 files · ~210,956 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 112 nodes · 206 edges · 12 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `showToast()` - 12 edges
2. `api()` - 12 edges
3. `loadContacts()` - 10 edges
4. `handleBatchSend()` - 9 edges
5. `sendEmail()` - 9 edges
6. `assert()` - 8 edges
7. `main()` - 8 edges
8. `renderContacts()` - 8 edges
9. `handleBatchPending()` - 8 edges
10. `authenticate()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `sendEmailViaProvider()` --calls--> `sendEmail()`  [INFERRED]
  server.js → /Users/yacinehida/Desktop/Automatisation MAIL/src/zimbra-client.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.27
Nodes (18): addBatchLog(), api(), closeBatchModal(), closeModal(), exitSelectMode(), handleBatchConfirm(), handleBatchDelete(), handleBatchPending() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.27
Nodes (12): authenticate(), buildEnvelope(), escapeXml(), mimeEncodeHeader(), parseAttachmentId(), parseAuthToken(), parseLifetime(), parseSoapFault() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (3): closeCampaignModal(), openBatchModal(), openSendAllModal()

### Community 3 - "Community 3"
Cohesion: 0.51
Nodes (9): assert(), main(), testCSS(), testFilesExist(), testGlowingShadow(), testHTML(), testLandingDark(), testResponsive() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (1): sendEmailViaProvider()

### Community 6 - "Community 6"
Cohesion: 0.52
Nodes (6): base64urlEncode(), buildMimeMessage(), generateBoundary(), getRefreshGoogleToken(), mimeEncodeHeader(), sendEmail()

### Community 7 - "Community 7"
Cohesion: 0.6
Nodes (5): buildMimeMessage(), generateBoundary(), getRefreshOutlookToken(), mimeEncodeHeader(), sendEmail()

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (5): getFilteredContacts(), renderContactSelection(), selectAllContacts(), toggleSelectContact(), updateBatchUI()

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (4): checkAuth(), handleLogout(), init(), showLoginSection()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (3): detectEmailColumn(), handleFileUpload(), openCampaignModal()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): getInitials(), openModal(), showAppSection()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): loadDocuments(), renderDocuments(), uploadDocuments()

## Knowledge Gaps
- **Thin community `Community 4`** (9 nodes): `buildOutlookRedirectUri()`, `buildRedirectUri()`, `detectEmailColumn()`, `getCookie()`, `getProviderLabel()`, `getUserForSend()`, `logError()`, `sendEmailViaProvider()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sendEmail()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `sendEmailViaProvider()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 0` to `Community 2`, `Community 10`, `Community 12`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._