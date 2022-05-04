import Crawler from "crawler";
import fs from "fs";
import path from "path";
import slugify from "slugify";

import remoteJobs from "../fixtures/remote-jobs.json";

const fixturesPath = path.resolve(__dirname, "../fixtures");

const markdownRegex = new RegExp(".*md$", "g");

const baseURL = "https://raw.githubusercontent.com";

const JOINER_CHAR = "=";

const crawler = new Crawler({
  maxConnections: 10,
  callback: function (error, res, done) {
    if (error) {
      console.log(error);
    } else {
      console.log("eta porra");
    }
    done();
  },
});

const TECHNOLOGIES_TITLE = "Company technologies";
const REGION_TITLE = "Region";
const CAREERS_TITLE = "How to apply";

const test = new RegExp(JOINER_CHAR, "g");

const listRegex = new RegExp("-|,", "g");

const getCompanyTechnologies = (unformattedData: string) =>
  unformattedData
    ?.replace(TECHNOLOGIES_TITLE, "")
    ?.replace(test, "")
    ?.replace(listRegex, "*")
    .split("*")
    .map((tech) => tech?.trim()?.toLowerCase())
    .filter((tech) => !!tech);

const getCompanyRegion = (unformattedData: string) =>
  unformattedData?.replace(REGION_TITLE, "")?.replace(test, "")?.trim();

const httpRegex = /\bhttps?:\/\/\S+/gi;

const httpMarkdownRegex = /https\:\/\/.*\)/g;

const getCompanyCareersPage = (unformattedData: string) =>
  unformattedData
    ?.replace(CAREERS_TITLE, "")
    ?.replace(test, "")
    ?.split("](")
    ?.map((career) => career?.match(httpRegex))
    ?.flat(2)
    // ?.match(httpRegex)
    ?.filter((career) => !!career)
    ?.map((career) => career?.replace(")", ""))?.[0];

const fetchCompanyDetails = (uri: string) =>
  new Promise((resolve, reject) => {
    let name = "";
    let technologies: string[] = [];
    let region = "";
    let careersPage = "";
    crawler.queue([
      {
        uri,
        jQuery: false,
        callback: function (error, res, done) {
          if (error) {
            console.error(error);
            reject(error);
          } else {
            const lines = (res?.body as string)
              ?.split("\n")
              .filter((line) => !!line);

            const [unformattedName, ...data] = lines;
            name = unformattedName.replace("# ", "");

            const unformattedData = data.join(JOINER_CHAR).split("##");

            unformattedData.forEach((row: string) => {
              if (row.includes(TECHNOLOGIES_TITLE)) {
                technologies = getCompanyTechnologies(row);
              }
              if (row.includes(REGION_TITLE)) {
                region = getCompanyRegion(row);
              }
              if (row.includes(CAREERS_TITLE)) {
                careersPage = getCompanyCareersPage(row) || "";
              }
            });
          }

          done();
          resolve({
            name,
            technologies,
            region,
            careersPage,
          });
        },
      },
    ]);
  });

const saveCompanies = (companies: any) => {
  const data = JSON.stringify(companies, null, 2);
  console.log("saving to ", fixturesPath);
  fs.writeFileSync(`${fixturesPath}/remote-jobs.json`, data);
};

const savePositions = (companyName: string, positions: any) => {
  try {
    const data = JSON.stringify(positions, null, 2);
    console.log("saving to ", fixturesPath);
    fs.writeFileSync(`${fixturesPath}/${companyName}.json`, data);
  } catch (error) {
    console.error(error);
    return null;
  }
};

const JOBS_KEYWORDS = [
  "engineer",
  "designer",
  "software",
  "scientist",
  "developer",
];

export const fetchRemoteCompanies = async () => {
  const companies: string[] = [];
  await new Promise((resolve, reject) => {
    crawler.queue([
      {
        uri: "https://github.com/remoteintech/remote-jobs/tree/main/company-profiles",
        callback: function (error, res, done) {
          if (error) {
            console.error(error);
            reject(error);
          } else {
            const $ = res.$;
            const $anchors = $("a");
            $anchors.each((i, link: any) => {
              const href = link?.attribs?.href;
              if (markdownRegex.test(href)) {
                companies.push(`${baseURL}${href}`?.replace("/blob", ""));
              }
            });
          }
          done();
          resolve(true);
        },
      },
    ]);
  });
  const formattedCompanies = await Promise.all(
    companies?.map((company) => fetchCompanyDetails(company))
  );
  saveCompanies(
    formattedCompanies?.filter((company: any) => !!company?.careersPage)
  );
};

const fetchCompanyPositions = (companyName: string, uri: string) =>
  new Promise((resolve, reject) => {
    const x: any = [];
    crawler.queue([
      {
        uri,
        callback: function (error, res, done) {
          if (error) {
            console.error(error);
            reject(error);
          } else {
            const $ = res.$;
            if (typeof $ === "function") {
              const $anchors = $("a");
              $anchors.each((i, link: any) => {
                const href = link?.attribs?.href;
                const text = $(link)
                  .text()
                  ?.trim()
                  ?.split("\n")
                  ?.map((t) => t?.trim())
                  ?.filter((t) => !!t)
                  ?.join(" - ");

                let url = href;
                if (!href?.includes("http")) {
                  url = `${res?.request?.uri?.protocol}//${res?.request?.uri?.hostname}/${href}`;
                }

                if (
                  JOBS_KEYWORDS?.some((keyword) =>
                    text?.toLowerCase()?.includes(keyword)
                  )
                ) {
                  x.push({ position: text, url });
                }

                if (
                  ["job openings", "open positions"].some((key) =>
                    text?.toLowerCase()?.includes(key)
                  )
                ) {
                  return fetchCompanyPositions(companyName, href);
                }
              });
              if (x.length === 0) {
                console.log("0 positions my friend", uri);
              }
            }
          }

          done();
          resolve({ companyName, positions: x });
        },
      },
    ]);
  });

const fetchCompaniesPositions = async () => {
  const jobs = await Promise.all(
    remoteJobs?.map((job) => fetchCompanyPositions(job.name, job.careersPage))
  ).catch((error) => {
    console.log("couldnt fetch", error);
  });
  jobs?.forEach((job: any, index) => {
    savePositions(`test-${index}`, job?.positions);
  });
};

// fetchCompanyPositions("https://www.15five.com/about/careers/");
// fetchCompanyPositions("axios", "https://www.axios.com/careers/");

fetchCompaniesPositions();

// fetchRemoteCompanies();
