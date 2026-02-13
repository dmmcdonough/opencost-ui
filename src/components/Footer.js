import React, { useEffect, useState } from "react";
import { Parser as HtmlToReactParser } from "html-to-react";
import client from "../services/api_client";

const htmlToReactParser = new HtmlToReactParser();

const Footer = () => {
  const [serverVersion, setServerVersion] = useState(null);

  useEffect(() => {
    client
      .get("/installInfo")
      .then((resp) => {
        if (resp.data?.version) {
          setServerVersion(resp.data.version);
        }
      })
      .catch(() => {});
  }, []);

  const content = '<div align="right"><br/>PLACEHOLDER_FOOTER_CONTENT</div>';
  const parsedContent = htmlToReactParser.parse(content);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div style={{ fontSize: 12, color: "#999", padding: "8px 0" }}>
        {serverVersion && <span>OpenCost {serverVersion}</span>}
      </div>
      <div>{parsedContent}</div>
    </div>
  );
};

export default Footer;
