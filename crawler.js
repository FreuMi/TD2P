async function crawl(startUri, maxDepth) {
  // Found Thing Descriptions
  const allCrawledTDs = new Set();
  // Visited URIs
  const allVisitedUris = new Set();
  // URIs to visit
  const urisToVisit = [];

  // Number of parallel connections
  const parallelCount = 800;

  // add start uri
  urisToVisit.push(startUri);

  let depthCounter = 0;

  while (urisToVisit.length > 0) {
    // Check depthCounter
    if (depthCounter >= maxDepth) {
      urisToVisit.length = 0;
      break;
    }

    const newlyFoundTDs = [];
    const newlyFoundURIs = [];
    // Visit all uris in uriToVisit
    while (urisToVisit.length > 0) {
      // Get URI to work on in parallel
      const currentUrisToVisit = [];
      for (let i = 0; i < parallelCount; i++) {
        if (urisToVisit.length !== 0) {
          const readUri = urisToVisit.pop();
          currentUrisToVisit.push(readUri);
        } else {
          break;
        }
      }
      const promiseArr = [];
      // visit all uris in currentUrisToVisit
      for (const uri of currentUrisToVisit) {
        promiseArr.push(fetchTD(uri));
      }

      //console.log("Size", promiseArr.length);
      const resultArr = await Promise.all(promiseArr);

      // Extract TD and new found uris from resultArr
      for (const result of resultArr) {
        newlyFoundTDs.push(result[0]);
        newlyFoundURIs.push(...result[1]);
      }

      // Add currentUrisToVisit to allVisitedUris
      allVisitedUris.add(...currentUrisToVisit);
    }

    // Add all newly found elements to the total elements
    for (const td of newlyFoundTDs) {
      allCrawledTDs.add(td);
    }
    urisToVisit.push(...newlyFoundURIs);

    // Increas depth counter
    depthCounter++;
  }

  return allCrawledTDs;
}

// Fetch Thing Description
async function fetchTD(uri) {
  let res;
  try {
    res = await fetch(uri);
  } catch (error) {
    throw error;
  }
  if (res.ok) {
    const nextTDLinks = [];
    // Get TD
    const td = await res.json();

    if (td.links) {
      // find type of link and get href
      for (const [_, value] of Object.entries(td.links)) {
        // If content type is application/td+json add td
        if (value.type === "application/td+json") {
          nextTDLinks.push(value.href);
          continue;
        }

        // Use head request to follow link and get content type
        const response = await fetch(value.href, {
          method: "HEAD",
          agent: httpsAgent,
        });
        const contentType = response.headers.get("Content-Type");

        // Check if content type is application/td+json
        if (contentType.includes("application/td+json")) {
          nextTDLinks.push(value.href);
          continue;
        }
      }
    }

    return [td, nextTDLinks];
  }
}

module.exports = {
  crawl: crawl,
};
