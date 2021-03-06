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

const cheerio = require('cheerio');
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

//endpoint to take Michigan GeoJSON and combine data with MI Covid Scraper data
//Encountered problem with format of Michigan GeoJSON, 5/1, saved county GeoJSON on GCP storage, then pull that to combine
//Added Michigan demographics from Cheerio scraper 5/19! Wanted to do that forever!
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
    const miDemoFetch = await fetch('https://geojsondataserver.firebaseapp.com/LocationArtistry/mi-demo-data/');
    //const miDemoFetch = await fetch('http://localhost:5000/LocationArtistry/mi-demo-data/');
    const miDemoJSON = await miDemoFetch.json();
    //console.log(miDemoJSON);
    var objCollection = {}, objCollection2 = {}, dataObject = {"County": "", "Cases": 0, "Deaths": 0}, 
    dataObject2 = {"countyName": "", "countyTotalPop": 0, "countyPopOver65": 0, "countyPop65per": 0};
    //create objCollection with key value of County Name
    for (x in miCovJSON.features) {
      const {County, Cases, Deaths} = miCovJSON.features[x].properties;
      dataObject = {"County": County, "Cases": Cases, "Deaths": Deaths};
      objCollection[County] = dataObject;
      //console.log(objCollection[County]);
    };
    //loop duplicate for miDemoJSON
    
    for (x in miDemoJSON) {
      const {countyName, countyTotalPop, countyPopOver65, countyPop65per} = miDemoJSON[x];
      dataObject2 = {"countyName": countyName, "countyTotalPop": countyTotalPop, "countyPopOver65": countyPopOver65, "countyPop65per": countyPop65per};
      objCollection2[countyName] = dataObject2;
      //console.log(miDemoJSON[x]);
      //console.log(dataObject2);
      //console.log(objCollection2[countyName]);
    };
    //console.log(objCollection2);

    //match up county GeoJSON from SOM with Covid data from SOM data fetch
    //Whew!  This took some time to remove ERROR from calling non-existent Object Property - March 31st 2020
    for (x in miCountyJSON.features) {
      const nameKey = (miCountyJSON.features[x].properties.NAME in objCollection), countyName = miCountyJSON.features[x].properties.NAME;
      miCountyJSON.features[x].properties.Confirmed = nameKey == true ? objCollection[countyName].Cases : 0;
      miCountyJSON.features[x].properties.Deaths = nameKey == true ? objCollection[countyName].Deaths : 0;
      const nameKey2 = (miCountyJSON.features[x].properties.NAME in objCollection2), countyName2 = miCountyJSON.features[x].properties.NAME;
      miCountyJSON.features[x].properties.countyTotalPop = nameKey2 == true ? objCollection2[countyName2].countyTotalPop : 0;
      miCountyJSON.features[x].properties.countyPopOver65 = nameKey2 == true ? objCollection2[countyName2].countyPopOver65 : 0;
      miCountyJSON.features[x].properties.countyPop65per = nameKey2 == true ? objCollection2[countyName2].countyPop65per : 0;
      miCountyJSON.features[x].properties.Confirmed != 0 ? (miCountyJSON.features[x].properties.countyCaseRatio = 
      Math.round(miCountyJSON.features[x].properties.countyTotalPop/miCountyJSON.features[x].properties.Confirmed)):
      (miCountyJSON.features[x].properties.countyCaseRatio=0);
      //console.log(`countyName2: ${countyName2} ${miCountyJSON.features[x].properties.countyCaseRatio}`);
      delete miCountyJSON.features[x].properties['Shape.STArea()'];
      delete miCountyJSON.features[x].properties['Shape.STLength()'];
      //This portion is being implementation when Michigan data is scraped
      //If CountyName = Wayne THEN add Detroit City Cases and Deaths
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

//Endpoint that returns an object of daily objects, each day contains daily and total cases and dths
  app.get('/LocationArtistry/mi-daily-report/', async (req, res) => {
      //Empty global object to use as database to store MI daily Covid Data
       let stateDataMI = {}, dailyCases=0, dailyDeaths=0, dailyRecov=0;
      //async function to build url date starting with March 22nd to dynamically create CSV url an fecth data
       const runDates = async () =>{
          const monLength = {"1":31,"2":28,"3":31,"4":30,"5":31,"6":30,"7":31,"8":31,"9":30,"10":31,"11":30,"12":31};
          let month = 3, day = 22, year = 2020, MIDataJSON;
          //Stop when date reaches yesterday, if first day in month then rollback to last day in previous month
          for(isYesterday = false;isYesterday == false;day++){
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
            //console.log(`monLength[month]: ${monLength[month]} month: ${month} monthNum: ${monthNum} day: ${day} dayNum: ${dayNum}`);
            const urlFetch = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/${urlDate}.csv`;
            const fetchMI = await fetch(urlFetch);
            //console.log(`Fecthing from: ${urlFetch}`);
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

//Endpoint that returns an object of daily CSHDA area objects, each day contains daily and total cases and dths
app.get('/LocationArtistry/daily-CHSDA-report/', async (req, res) => {
  //Empty global object to use as database to store MI daily Covid Data
   let stateDataMI = {}, dailyCases=0, dailyDeaths=0, dailyRecov=0;
  //async function to build url date starting with March 22nd to dynamically create CSV url an fecth data
   const runDates = async () =>{
      const monLength = {"1":31,"2":28,"3":31,"4":30,"5":31,"6":30,"7":31,"8":31,"9":30,"10":31,"11":30,"12":31};
      let month = 3, day = 22, year = 2020, MIDataJSON;
      //Stop when date reaches yesterday, if first day in month then rollback to last day in previous month
      for(isYesterday = false;isYesterday == false;day++){
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
        const urlFetch = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/${urlDate}.csv`;
        const fetchMI = await fetch(urlFetch);
        const fetchMIJSON = await fetchMI.text();
        let stringLines = fetchMIJSON.split("\n"), MIData = [];
        eachLine = (item, index) => (MIData[index] = item.split(","));
        stringLines.forEach(eachLine);
        MIDataJSON = await buildFeatures(MIData, urlDate);
      }
      for(z in MIDataJSON){
        //hard code in the cases for 03-22, the day JHU Github repo begins reporting Michigan by County
        dailyCases == 0 ? (MIDataJSON[z].Daily_Cases = 32) : (MIDataJSON[z].Daily_Cases = (MIDataJSON[z].Confirmed - dailyCases));
        dailyCases = MIDataJSON[z].Confirmed;
        dailyDeaths == 0 ? (MIDataJSON[z].Daily_Deaths = 0) : (MIDataJSON[z].Daily_Deaths = (MIDataJSON[z].Deaths - dailyDeaths));
        dailyDeaths = MIDataJSON[z].Deaths;
        dailyRecov == 0 ? (MIDataJSON[z].Daily_Recovered = 0) : (MIDataJSON[z].Daily_Recovered = (MIDataJSON[z].Recovered - dailyRecov));
        dailyRecov = MIDataJSON[z].Recovered;
      }
      return MIDataJSON;
    }
   //Take parsed CSV data and create each GeoJSON feature, add to GeoJSON object corvidGeoJSON
   const buildFeatures = async (featuresData, dateRecord) => {
     stateDataMI[dateRecord] = {"Country": "US", "Prov_State": "NHBP_CHSDA", "Confirmed": 0, "Deaths": 0, "Recovered": 0, "Updated": "",
                                "Daily_Cases": 0, "Daily_Deaths": 0, "Daily_Recovered": 0};
     eachRecord = (item, index) => {
        //(item[1]=="Calhoun"||item[1]=="Kalamazoo"||item[1]=="Branch"||item[1]=="Allegan"||item[1]=="Kent"||item[1]=="Barry"||item[1]=="Ottawa"
        //Calhoun=2Kal=0,Branch=0,Allegan=1,Kent=22,Barry=1,Ottawa=6
        item[2] == "Michigan" ? (item[1]=="Calhoun"||item[1]=="Kalamazoo"||item[1]=="Branch"||item[1]=="Allegan"||item[1]=="Kent"||item[1]=="Barry"||item[1]=="Ottawa"
        ? ((stateDataMI[dateRecord].Confirmed = stateDataMI[dateRecord].Confirmed + Number(item[7]),
        stateDataMI[dateRecord].Deaths = stateDataMI[dateRecord].Deaths + Number(item[8]),
        stateDataMI[dateRecord].Recovered = stateDataMI[dateRecord].Recovered + Number(item[9]))):""):"";
      };
     featuresData.forEach(eachRecord);
     console.log(stateDataMI);
     return stateDataMI
   };

   try {
       const MIParsed = await runDates();
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

//New endpoint to scrape Michigan Demographics data per county
app.get("/LocationArtistry/mi-demo-data/", async (req, res) => {
  const scrapeDemo = async (url) => {
      async function requests(url) {
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      let x = 3, countyArray = [], nextCounty = 1;
      while(nextCounty != "") {
          const countyName = ($(`table > tbody > tr:nth-child(${x}) > td.leftAligned`).text()).trim();
          const countyTotalPop = (($(`table > tbody > tr:nth-child(${x}) > td:nth-child(2)`).text()).trim()).replace(/,/g,"");
          const countyPopOver65 = (($(`table > tbody > tr:nth-child(${x}) > td:nth-child(3)`).text()).trim()).replace(/,/g,"")
          const countyPop65per = ($(`table > tbody > tr:nth-child(${x}) > td:nth-child(4)`).text()).trim();
          nextCounty = ($(`table > tbody > tr:nth-child(${x+1}) > td:nth-child(4)`).text()).trim();
          const countyObject = {'countyName': countyName, 'countyTotalPop': Number(countyTotalPop), 'countyPopOver65': Number(countyPopOver65), 'countyPop65per': countyPop65per };
          countyArray[x-3] = countyObject;
          x++;
      }
      return countyArray;
  };
  //console.log('before request2');
  const request2 = await requests(url);
  return request2;
}
try {
      //const body = JSON.parse(request.body);
      const data = await scrapeDemo('https://www.mdch.state.mi.us/pha/osr/CHI/POP/MAIN/PO17CO1.htm');
      res.send(data);
}
catch (err) {
  console.error("SOM Demographics Scrape Fail");
  res
  .status(400)
  .send('ERROR MESSAGE bad SCRAPE AMTE!');
}
});

//New endpoint to scrape Michigan Totals info with Cheerio
app.get("/LocationArtistry/mi-totals-data/", async (req, res) => {
  // Mi pop site body > div > center > table > tbody > tr:nth-child(3) > td.leftAligned
  // #main > div.row.row-eq-height.content-block-section > div.page-content-block > div:nth-child(1) > div:nth-child(1) > div > table > tbody > tr:nth-child(1) > td:nth-child(1)
  // #main > div.row.row-eq-height.content-block-section > div.page-content-block > div:nth-child(1) > div:nth-child(1) > 
  // div > table > tbody > tr:nth-child(1) > td:nth-child(3)
  const scrapeDemo = async (url) => {
      console.log(url);
      async function requests(url) {
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      let x = 1, countyArray = [], nextCounty = 1;
      while(nextCounty != "") {
          const countyName = ($(`div:nth-child(1) > div:nth-child(1) > div > table > tbody > tr:nth-child(${x}) > td:nth-child(1)`).text()).trim();
          const countyCases = ($(`div:nth-child(1) > div:nth-child(1) > div > table > tbody > tr:nth-child(${x}) > td:nth-child(2)`).text()).trim();
          const countyDeaths = ($(`div:nth-child(1) > div:nth-child(1) > div > table > tbody > tr:nth-child(${x}) > td:nth-child(3)`).text()).trim();
          const totalRecover = (($('span.shortdesc > p:nth-child(2) > strong > span > span').text()).trim()).replace(/,/g,"");
          console.log(totalRecover);
          //const countyPop65per = ($(`table > tbody > tr:nth-child(${x}) > td:nth-child(4)`).text()).trim();
          // #comp_115181 > ul > li:nth-child(2) > span > span > span.shortdesc > p:nth-child(2) > strong > span
          // #comp_115181 > ul > li:nth-child(2) > span > span > span.shortdesc > p:nth-child(2) > strong > span > span
          // #comp_115181 > ul > li:nth-child(2) > span > span > span.shortdesc > p:nth-child(2)
          nextCounty = ($(`table > tbody > tr:nth-child(${x+1}) > td:nth-child(1)`).text()).trim();
          const countyObject = {'County': countyName, 'Cases': Number(countyCases), 'Deaths': Number(countyDeaths), 'RecovTotal': Number(totalRecover)};
          countyArray[x-1] = countyObject;
          x++;
      }  
      return countyArray;
  };
  //console.log('before request2');
  const request2 = await requests(url);
  return request2;
}
try {
      //const body = JSON.parse(request.body);
      const data = await scrapeDemo('https://www.michigan.gov/coronavirus/0,9753,7-406-98163_98173---,00.html');
      res.send(data);
}
catch (err) {
  console.error("SOM Demographics Scrape Fail");
  res
  .status(400)
  .send('ERROR MESSAGE bad SCRAPE AMTE!');
}
});

exports.api = functions.runWith({ memory: '2GB' }).https.onRequest(app);