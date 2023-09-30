import React, { useState, useEffect } from "react";
import { Navbar, Container, Row, Col, Button, Form, Table } from "react-bootstrap";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import "bootstrap/dist/css/bootstrap.min.css";
import prettyBytes from "pretty-bytes";
import moment from "moment";

const BUCKET_NAME = window.BUCKET_NAME;
const PAGE_SIZE = window.PAGE_SIZE || 20;
const REGION = window.REGION || "us-east-1";

function App() {

  const [files, setFiles] = useState([]);
  const [page, setPage] = useState(1);
  const [truncated, setTruncated] = useState(true);
  const [prefix, setPrefix] = useState([]);
  const [continuationTokens, setContinuationTokens] = useState([]);
  const [search, setSearch] = useState("");

  function updateFiles(tokens = [], pref = [], query = "") {
    const s3Client = new S3Client({
      region: REGION,
      signer: { sign: async (request) => request }
    });

    const joinedPrefix = (pref.length ? pref.join("/") + "/" : "") + query;

    const fetchFiles = async () => {
      try {
        const payload = {
          Bucket: BUCKET_NAME,
          MaxKeys: PAGE_SIZE,
          Delimiter: "/",
          Prefix: joinedPrefix
        };
        if (tokens.length > 0) {
          payload.ContinuationToken = tokens.slice(-1);
        }
        const command = new ListObjectsV2Command(payload);
        const response = await s3Client.send(command);
        setTruncated(response.IsTruncated);
        setFiles([...response.Contents || [], ...response.CommonPrefixes || []]);
        setPage(tokens.length + 1);
        if (response.NextContinuationToken) {
          setContinuationTokens([...tokens, response.NextContinuationToken]);
        }
      } catch (error) {
        console.error("Error fetching files from S3:", error);
      }
    };

    fetchFiles();
  }

  useEffect(() => {
    updateFiles();
  }, []);

  function handlePrevious() {
    if (continuationTokens.length > 1) {
      const newTokens = [...continuationTokens];
      newTokens.pop();
      newTokens.pop();
      setContinuationTokens(newTokens);
      updateFiles(newTokens, prefix);
    }
  }

  function handleNext() {
    if (continuationTokens.length > 0) {
      updateFiles(continuationTokens, prefix);
    }
  }

  function handlePrefix(newPrefix) {
    let splitPrefix;
    if (newPrefix === "") {
      splitPrefix = [];
    } else {
      splitPrefix = newPrefix.replace(/\/$/, "").split("/");
    }
    setSearch("");
    setPrefix(splitPrefix);
    setContinuationTokens([]);
    updateFiles([], splitPrefix, "");
  }

  function handleSearch(event) {
    const query = event.target.value;
    setSearch(query);
    updateFiles([], prefix, query);
  };

  return (
    <div className="App">
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand href="/index.html">
            S3 file listing: {BUCKET_NAME}
          </Navbar.Brand>
        </Container>
      </Navbar>
      <Container className="mt-3 mb-3">
        <Row>
          <Col>
            <Form.Group className="mb-3 col-3">
              <Form.Control type="text" placeholder="Search in path" value={search} onChange={handleSearch} />
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col>
            <p>
              <a href="#" onClick={() => handlePrefix("")}>root</a>
              { prefix.map((p, i) => <span key={p}><span className="ms-1 me-1">/</span><a href="#" onClick={() => handlePrefix(prefix.slice(0, i + 1).join("/"))}>{p}</a></span>) }
            </p>
          </Col>
        </Row>
        <Row>
          <Col>
            <Table size="sm">
              <tbody>
                {files.filter(file => file.Key !== prefix.join("/") + "/").map((file) => {
                  if (file.Key) {
                    return <tr key={file.Key}>
                      <td><a rel="noreferrer" href={"https://" + BUCKET_NAME + ".s3.amazonaws.com/" + file.Key} target="_blank">{file.Key.split("/").slice(-1)}</a></td>
                      <td>{prettyBytes(file.Size)}</td>
                      <td>{moment(file.LastModified).format("YYYY-MM-DD HH:mm")}</td>
                    </tr>
                  } else if (file.Prefix) {
                    return <tr key={file.Prefix}><td colSpan="3"><a href="#" onClick={() => handlePrefix(file.Prefix)}>{file.Prefix.split("/").slice(-2)}</a></td></tr>
                  }
                })}
              </tbody>
            </Table>
          </Col>
        </Row>
        <Row className="mt-2">
          <Col>
            <Button disabled={continuationTokens.length < 2} onClick={handlePrevious}>Previous</Button>
            <Button disabled={!truncated} className="ms-2" onClick={handleNext}>Next</Button>
            <span className="ms-3">Page {page}</span>
          </Col>
        </Row>
      </Container>
      {/* <footer className="footer mt-auto pt-4 pb-4 bg-light">
        <Container>
        <Row>
          <Col lg={true}>
            <span className="text-muted">https://github.com/pieterprovoost/s3ls</span>
          </Col>
        </Row>
        </Container>
      </footer> */}
    </div>
  );
}

export default App;
