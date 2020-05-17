require('dotenv').config();
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId
};
//console.log(firebaseConfig2);    
const functions = require('firebase-functions');
const admin = require('firebase-admin');
//var firebase = require("firebase/app");
//admin.initializeApp(functions.config().firebase);
//firebase.initializeApp(firebaseConfig);
admin.initializeApp(firebaseConfig);

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: true }))

app.get("/LocationArtistry/testCloud/", async (req, res) => {
    const {Storage} = require('@google-cloud/storage');
    const storage = new Storage();
    const downloadedContents = await storage.bucket('gs://geojsondataserver.appspot.com').file('MI_COUNTIES_EK.json').download();
    const miCountyJSON = await downloadedContents[0].toString();
    const testFeatures = await JSON.parse(miCountyJSON);
    const moreTesting = testFeatures.features[0];
    res
      .status(200)
      .send(moreTesting);
})

/*This is the data repository for the 2019 Novel Coronavirus Visual Dashboard operated by the Johns Hopkins University Center for 
Systems Science and Engineering (JHU CSSE). Also, Supported by ESRI Living Atlas Team and the Johns Hopkins University Applied 
Physics Lab (JHU APL): https://github.com/CSSEGISandData/COVID-19*/
app.get("/LocationArtistry/CovidGeoJSON/", async (req, res) => {
    //Empty object with GeoJSON formatting
    var covidGeoJSON = { "type": "FeatureCollection", "metadata": "", "features": []};
        //Dynamically contruct url using js date functions, data posts at 4 pm use data from day before today
        let today = new Date(), monthNum = (today.getMonth() + 1), dayNum = ((today.getDate())-1), yearNum = today.getFullYear();
        const monLength = {"1":31,"2":28,"3":31,"4":30,"5":31,"6":30,"7":31,"8":31,"9":30,"10":31,"11":30,"12":31};
        monthNum = dayNum == 0 ? monthNum - 1 : monthNum;
        monthNum = monthNum == 0 ? 12 : monthNum;
        dayNum = dayNum == 0 ? monLength[monthNum] : dayNum;
        let dayString = dayNum.toString();
        dayString = dayNum < 10 ? "0" + dayString : dayString;
        const urlDate = monthNum < 10 ? `0${monthNum}-${dayString}-${yearNum}` : `${monthNum}-${dayString}-${yearNum}`;
        console.log(`FetchUrl Date: ${urlDate}`);
        const urlFetch = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/${urlDate}.csv`;
        console.log(`Fecthing from: ${urlFetch}`);
        //Fetch function get Covid CSV data, split by line and by comma 
        async function getCovid(urlData) {
          const fetchDisease = await fetch(urlData);
          const diseaseJSON = await fetchDisease.text();
          let stringLines = diseaseJSON.split("\n"), countryData = [];
          eachLine = (item, index) => (countryData[index] = item.split(","));
          stringLines.forEach(eachLine);
          return countryData;
        }
        //Take parsed CSV data and create each GeoJSON feature, add to GeoJSON object corvidGeoJSON
        const buildFeatures = async (featuresData) => {
          eachRecord = (item, index) => {
            if (index != 0) {                                                                                                                                                                                                      
              const mapObject = { "type": "Feature", "properties": { "FIPS": item[0], "Country": item[3], "Prov_State": item[2], "County_Admin": item[1],
                                "Confirmed": item[7], "Deaths": item[8], "Recovered": item[9], "Updated": item[4]}, 
                                "geometry": { "type": "Point", "coordinates": [Number(item[6]), Number(item[5])]} };
              covidGeoJSON.features[index-1] = mapObject;
            };
          };
          featuresData.forEach(eachRecord);
          return covidGeoJSON;
        };
        try {
            const covidParsed = await (getCovid(urlFetch));
            const finalGeoJSON = await buildFeatures(covidParsed);
            res
            .status(200)
            .send(finalGeoJSON);
        }
        catch (err) {
            console.error("Your GeoJSON fetch is went WRONG!");
            res
            .status(400)
            .send('ERROR MESSAGE bad GeoJSON mate!');
        }
    })


//Michigan data scraper, Michigan.gov Coronavirus website table
app.get("/LocationArtistry/mi-covid-data/", async (req, res) => {
  try {
    //Call scrapeSite function with url and ID of scrape target
    const scrapeUrl = "https://www.michigan.gov/coronavirus/0,9753,7-406-98163_98173---,00.html";
    const scrapeID = "STATE OF MICHIGAN COVID-19 DATA"
    const scrapeRecord = await scrapeSite(scrapeUrl, scrapeID);
    res
      .status(200)
      .json(await scrapeRecord);
} catch (error) {
  console.log('ERROR!!!!');
  res
  .status(400)
  .send('ERROR YOUR STATE MI SCRAPE AINT CUTTING IT');
}
async function scrapeSite(url, targetID) {
    //opens browser to start scrape
    console.log(`Scraping: ${targetID} at: ${url}`);
    const browser1 = await puppeteer.launch({args: ['--no-sandbox']});
    const page1 = await browser1.newPage();
    await page1.goto(url);
    //build JSON object from table
    let miCountiesCovid = { "type": "FeatureCollection", "metadata": "", "features": []}, countyObject = {}, detObject = {"type": "Feature", "properties": { "County": "NONE", "Cases": 0, "Deaths": 0, "coordinates": [0, 0] } };
    let [elcountyName] = "", countyNameTxt, countyNameJSON, countyName;
    let [elcountyCases] = "", countyCasesTxt, countyCasesJSON, countyCases;
    let [elcountyDeaths] = "", countyDeathsTxt, countyDeathsJSON, countyDeaths;
    let [elnextCounty] = "", nextCountyTxt, nextCountyJSON, nexTest = false, testExp = /Total/g;
    let [eltotalCases] = "", totalCasesTxt, totalCasesJSON, totalCases;
    let [eltotalDeaths] = "", totalDeathsTxt, totalDeathsJSON, totalDeaths, i=0, z=0;
    for (i=1;(nexTest!=true);i++) {
          //Loop through scraped table of Michigan counties, assign name, cases, deaths
          [elcountyName] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+i+']/td[1]');
          countyNameTxt = await elcountyName.getProperty('textContent');
          countyNameJSON = await countyNameTxt.jsonValue();
          countyName = countyNameJSON.trim();
          countyName = countyName.substring(0, 2) == "St" ? (countyName = `St.${countyName.substring(2, countyName.length)}`) : countyName;
          [elcountyCases] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+i+']/td[2]');
          countyCasesTxt = await elcountyCases.getProperty('textContent');
          countyCasesJSON = await countyCasesTxt.jsonValue();
          countyCases = Number(countyCasesJSON);
          [elcountyDeaths] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+i+']/td[3]');
          countyDeathsTxt = await elcountyDeaths.getProperty('textContent');
          countyDeathsJSON = await countyDeathsTxt.jsonValue();
          countyDeaths = Number(countyDeathsJSON);
          [elnextCounty] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+(i+1)+']/td[1]');
          nextCountyTxt = await elnextCounty.getProperty('textContent');
          nextCountyJSON = await nextCountyTxt.jsonValue();
          nexTest = testExp.test(nextCountyJSON);
          //If countyName = Detroit City assign data to detObject, otherwise maintain 0 values
          //Add county object to array as long as name DOES NOT equal Detroit City, IF = Detroit THEN assign cases and deaths to detObject
          countyName != "Detroit City" ? (countyObject = {"type": "Feature", "properties": { "County": countyName, "Cases": countyCases, 
                              "Deaths": countyDeaths, "coordinates": [0, 0] } }, miCountiesCovid.features[z] = countyObject, z++) : 
                              (detObject = {"type": "Feature", "properties": { "County": countyName, "Cases": countyCases, "Deaths": countyDeaths, "coordinates": [0, 0] } });
     
          //When county = Wayne THEN add Detroit Cases and Deaths
          countyName == "Wayne" ? (miCountiesCovid.features[z-1].properties.Cases = miCountiesCovid.features[z-1].properties.Cases + detObject.properties.Cases) : "";
        
    }
    [eltotalCases] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+(i)+']/td[2]');
    totalCasesTxt = await eltotalCases.getProperty('textContent');
    totalCasesJSON = await totalCasesTxt.jsonValue();
    totalCases = Number(totalCasesJSON);
    [eltotalDeaths] = await page1.$x('/html/body/div[3]/div[4]/div/div/div[3]/div[2]/div[1]/div[1]/div/table/tbody/tr['+(i)+']/td[3]');
    totalDeathsTxt = await eltotalDeaths.getProperty('textContent');
    totalDeathsJSON = await totalDeathsTxt.jsonValue();
    totalDeaths = Number(totalDeathsJSON);
    const totalObject = {"type": "Feature", "properties": { "County": "TOTALS", "Cases": "TOTALS", 
                          "Deaths": "TOTALS", "TotalCases": totalCases, "TotalDeaths": totalDeaths, "coordinates": [0, 0] } };
    miCountiesCovid.features[z] = totalObject;
    console.log(`i: ${i} Total Deaths: ${totalDeaths} Total Cases: ${totalCases}`);
    console.log(totalObject);
    console.log(`FINISHED SCRAPING!: ${targetID} at: ${url}`);
    browser1.close(); 
    return miCountiesCovid; 
  }  
})

//new endpoint to take Michigan GeoJSON and combine data with MI Covid Scraper data
//Encountered problem with format of Michigan GeoJSON, 5/1, saved county GeoJSON on GCP storage, then pull that to combine
app.get("/LocationArtistry/mi-covid-combined/", async (req, res) => {
  try {
    //const miCovFetch = await fetch('http://localhost:5000/LocationArtistry/mi-covid-data/');
    const miCovFetch = await fetch('https://geojsondataserver.firebaseapp.com/LocationArtistry/mi-covid-data/');
    const miCovJSON = await miCovFetch.json();
    //Get Counties GeoJSON from GCP Storage Bucket
    const {Storage} = require('@google-cloud/storage');
    const storage = new Storage();
    const downloadedContents = await storage.bucket('gs://geojsondataserver.appspot.com').file('MI_COUNTIES_EK.json').download();
    const rawData = await downloadedContents[0].toString();
    const miCountyJSON = await JSON.parse(rawData);
    //old Michigan endpoint for faulty GeoJSON format
    //const miCountyFetch = await fetch('https://opendata.arcgis.com/datasets/67a8ff23b5f54f15b7133b8c30981441_0.geojson');
    //const miCountyJSON = await miCountyFetch.json();
    var objCollection = {}, dataObject = {"County": "", "Cases": 0, "Deaths": 0};
    //create objCollection with key value of County Name
    for (x in miCovJSON.features) {
      const {County, Cases, Deaths} = miCovJSON.features[x].properties;
      dataObject = {"County": County, "Cases": Cases, "Deaths": Deaths};
      objCollection[County] = dataObject;
    };
    //match up county GeoJSON from SOM with Covid data from SOM data fetch
    //Whew!  This took some time to remove ERROR from calling non-existent Object Property - March 31st 2020
    for (x in miCountyJSON.features) {
      const nameKey = (miCountyJSON.features[x].properties.NAME in objCollection), countyName = miCountyJSON.features[x].properties.NAME;
      miCountyJSON.features[x].properties.Confirmed = nameKey == true ? objCollection[countyName].Cases : 0;
      miCountyJSON.features[x].properties.Deaths = nameKey == true ? objCollection[countyName].Deaths : 0;
      delete miCountyJSON.features[x].properties['Shape.STArea()'];
      delete miCountyJSON.features[x].properties['Shape.STLength()'];
      //console.log(miCountyJSON.features[x].properties);
      //This portion is being implementation when Michigan data is scraped
      //If CountyName = Wayne THEN add Detroit City Cases and Deaths
      //miCountyJSON.features[x].properties.Confirmed = countyName == "Wayne" ? miCountyJSON.features[x].properties.Confirmed + objCollection["Detroit City"].Cases : miCountyJSON.features[x].properties.Confirmed;
      //miCountyJSON.features[x].properties.Deaths = countyName == "Wayne" ? miCountyJSON.features[x].properties.Deaths + objCollection["Detroit City"].Deaths : miCountyJSON.features[x].properties.Deaths;
    }
    res
      .status(200)
      .json(await miCountyJSON);
    } catch (error) {
  console.log('ERROR!!!!');
  res
  .status(400)
  .send('ERROR COMBINED MI GeoJSON DATA FAIL');
}
})

app.get("/LocationArtistry/covid-us-totals/", async (req, res) => {
      //Empty global object to use as database to store US State level data 
      let stateDataUS = {}, stateDataObj = {}, topTenStates = [];
      //Dynamically contruct url using js date functions, data posts at 4 pm use data from day before today
      let today = new Date(), monthNum = (today.getMonth() + 1), dayNum = ((today.getDate())-1), yearNum = today.getFullYear();
      const monLength = {"1":31,"2":28,"3":31,"4":30,"5":31,"6":30,"7":31,"8":31,"9":30,"10":31,"11":30,"12":31};
      monthNum = dayNum == 0 ? monthNum - 1 : monthNum;
      monthNum = monthNum == 0 ? 12 : monthNum;
      dayNum = dayNum == 0 ? monLength[monthNum] : dayNum;
      let dayString = dayNum.toString();
      dayString = dayNum < 10 ? "0" + dayString : dayString;
      const urlDate = monthNum < 10 ? `0${monthNum}-${dayString}-${yearNum}` : `${monthNum}-${dayString}-${yearNum}`;
      console.log(`FetchUrl Date: ${urlDate}`);
      const urlFetch = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/${urlDate}.csv`;
      console.log(`Fecthing from: ${urlFetch}`);
      //Fetch function get Covid CSV data, split by line and by comma 
      async function getCovid(urlData) {
        const fetchC19 = await fetch(urlData);
        const C19JSON = await fetchC19.text();
        let stringLines = C19JSON.split("\n"), countryData = [];
        eachLine = (item, index) => (countryData[index] = item.split(","));
        stringLines.forEach(eachLine);
        return countryData;
      }
      //Take parsed CSV data and create each GeoJSON feature, add to GeoJSON object corvidGeoJSON
      const buildFeatures = async (featuresData) => {
        stateDataUS["TOTALS"] = {"Country": "US", "Prov_State": "ALL", "Confirmed": 0, "Deaths": 0, "Recovered": 0, "Updated": ""};
        eachRecord = (item, index) => {
          const nameKey = (item[2] in stateDataUS);
          if (item[3] == "US") {                                                                                                                                                                                                      
            stateDataObj = {"Country": item[3], "Prov_State": item[2], "Confirmed": Number(item[7]), "Deaths": Number(item[8]), 
                            "Recovered": Number(item[9]), "Updated": item[4]};
            stateDataUS["TOTALS"].Confirmed = stateDataUS["TOTALS"].Confirmed + stateDataObj.Confirmed;
            stateDataUS["TOTALS"].Deaths = stateDataUS["TOTALS"].Deaths + stateDataObj.Deaths;  
            stateDataUS["TOTALS"].Recovered = stateDataUS["TOTALS"].Recovered + stateDataObj.Recovered;
            nameKey == true ? (stateDataUS[item[2]].Confirmed = stateDataUS[item[2]].Confirmed + stateDataObj.Confirmed, 
                                stateDataUS[item[2]].Deaths = stateDataUS[item[2]].Deaths + stateDataObj.Deaths,
                                stateDataUS[item[2]].Recovered = stateDataUS[item[2]].Recovered + stateDataObj.Recovered):
                                stateDataUS[item[2]] = stateDataObj;
            //console.log(stateDataUS["TOTALS"]);
          };
        };
        featuresData.forEach(eachRecord);
        return stateDataUS
      };
      try {
          const covidParsed = await (getCovid(urlFetch));
          const stateDataJSON = await buildFeatures(covidParsed);
          res
          .status(200)
          .send(stateDataJSON);
      }
      catch (err) {
          console.error("Your GeoJSON fetch is went WRONG!");
          res
          .status(400)
          .send('ERROR MESSAGE bad GeoJSON mate!');
      }
  })

  app.get('/LocationArtistry/mi-daily-report/', async (req, res) => {
       //Empty global object to use as database to store US State level data 
       let stateDataMI = {}, stateDataObj = {}, topTenStates = [], dailyCases=0, dailyDeaths=0, dailyRecov=0;
       //new async function to loop through date range starting March 22nd to get daily series for Michigan
       const runDates = async () =>{
          const monLength = {"1":31,"2":28,"3":31,"4":30,"5":31,"6":30,"7":31,"8":31,"9":30,"10":31,"11":30,"12":31};
          let month = 3, day = 22, year = 2020, MIDataJSON;
          //Loop through dates to create dynamic url for each day
          //stop when date reaches yesterday, if first day in month then rollback to last day in previous month
          for(isYesterday = false;isYesterday == false;day++){
            //for(x=0;x<50;x++){
            day > monLength[month] ? (month = month + 1, day = 1) : ("");
            monthString = month.toString();
            month < 10 ? (monthString = "0" + monthString) : "";
            dayString = day.toString();
            day < 10 ? (dayString = "0" + dayString) : "";
            const urlDate = `${monthString}-${dayString}-${year}`;
            const today = new Date();
            let monthNum = (today.getMonth() + 1), dayNum = ((today.getDate())-1), yearNum = today.getFullYear();
            dayNum == 0 ? (dayNum = monLength[month], monthNum = monthNum-1) : "";
            month == monthNum ? (isYesterday = day == dayNum ? true : false) : "";
            console.log(`monLength[month]: ${monLength[month]} month: ${month} monthNum: ${monthNum} day: ${day} dayNum: ${dayNum}`);
            const urlFetch = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/${urlDate}.csv`;
            const fetchMI = await fetch(urlFetch);
            console.log(`Fecthing from: ${urlFetch}`);
            const fetchMIJSON = await fetchMI.text();
            let stringLines = fetchMIJSON.split("\n"), MIData = [];
            eachLine = (item, index) => (MIData[index] = item.split(","));
            stringLines.forEach(eachLine);
            MIDataJSON = await buildFeatures(MIData, urlDate);
          }
        
          for(z in MIDataJSON){
            //hard code in the cases for 03-22, the day JHU Github repo begins reporting Michigan by County
            dailyCases == 0 ? (MIDataJSON[z].Daily_Cases = 247) : (MIDataJSON[z].Daily_Cases = (MIDataJSON[z].Confirmed - dailyCases));
            dailyCases = MIDataJSON[z].Confirmed;
            dailyDeaths == 0 ? (MIDataJSON[z].Daily_Deaths = 4) : (MIDataJSON[z].Daily_Deaths = (MIDataJSON[z].Deaths - dailyDeaths));
            dailyDeaths = MIDataJSON[z].Deaths;
            dailyRecov == 0 ? (MIDataJSON[z].Daily_Recovered = 0) : (MIDataJSON[z].Daily_Recovered = (MIDataJSON[z].Recovered - dailyRecov));
            dailyRecov = MIDataJSON[z].Recovered;
          }
      
          return MIDataJSON;
        }
       //Take parsed CSV data and create each GeoJSON feature, add to GeoJSON object corvidGeoJSON
       const buildFeatures = async (featuresData, dateRecord) => {
         stateDataMI[dateRecord] = {"Country": "US", "Prov_State": "Michigan", "Confirmed": 0, "Deaths": 0, "Recovered": 0, "Updated": "",
                                    "Daily_Cases": 0, "Daily_Deaths": 0, "Daily_Recovered": 0};
         eachRecord = (item, index) => {
           item[2] == "Michigan" ? (stateDataMI[dateRecord].Confirmed = stateDataMI[dateRecord].Confirmed + Number(item[7]),
                                  stateDataMI[dateRecord].Deaths = stateDataMI[dateRecord].Deaths + Number(item[8]),
                                  stateDataMI[dateRecord].Recovered = stateDataMI[dateRecord].Recovered + Number(item[9])):"";
         };
         featuresData.forEach(eachRecord);
         return stateDataMI
       };
       try {
           const MIParsed = await runDates();
           //const stateDataJSON = await buildFeatures(covidParsed);
           res
           .status(200)
           .send(MIParsed);
       }
       catch (err) {
           console.error("Your GeoJSON fetch is went WRONG!");
           res
           .status(400)
           .send('ERROR MESSAGE bad GeoJSON mate!');
       }
   })


exports.api = functions.runWith({ memory: '2GB' }).https.onRequest(app);