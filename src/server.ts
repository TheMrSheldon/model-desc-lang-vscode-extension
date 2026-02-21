import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

documents.onDidChangeContent(change => {
  const document = change.document;
  // Implement parsing and analyzing code logic here
  // Send diagnostics (errors) to the editor using connection.sendDiagnostics()
});
connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Add other capabilities as needed
    },
  };
});
documents.listen(connection);
connection.listen();