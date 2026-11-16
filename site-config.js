// ============================================================
//  EASY EDITS — this is the only file the family needs to touch.
//  Change a value, save, upload to GitHub, done.
// ============================================================
window.SITE = {

  // --- "I was here" counter and visitor photos ---------------
  // Paste the web app address from Google Apps Script here
  // (see backend/SETUP.md). It looks like:
  //   "https://script.google.com/macros/s/XXXXXXXX/exec"
  // While this is "", the button still works but there is no shared
  // count, and the visitor photo section stays hidden.
  backendUrl: "https://script.google.com/macros/s/AKfycbzdHxowVzQQ47nfVS58kM-QJa4d_oOY_tas_2V-6EJ8kmG0E8KYj0LTdsJoYxEJhr6SEg/exec",

  // --- The bench ---------------------------------------------
  // Name of the park, e.g. "Warwick Community Park". Leave "" to skip.
  parkName: "",

  // A photo of the bench. Put the file in the images folder and
  // write its name here, e.g. "images/bench.jpg". Leave "" to skip.
  benchPhoto: "",

  // A Google Maps link to the bench (open Google Maps, drop a pin on
  // the bench, tap Share, copy the link). Leave "" to hide the button.
  benchMapLink: "",

  // Where the bench is, so the sky at the top of the page matches the
  // real sky there (sunrise, daylight, sunset, stars). These numbers
  // are for Jamison, PA; anywhere nearby is close enough.
  benchLatitude: 40.255,
  benchLongitude: -75.09,

  // --- Photos of Ryan ----------------------------------------
  // Add one line per photo. Put the files in the images folder.
  // The section appears on the page once there is at least one.
  //   { file: "images/ryan-fishing.jpg", caption: "Ryan at the shore, 2012" },
  photos: [

  ],

  // --- Links ---------------------------------------------------
  memoryLink: "https://bigrgolf.com",   // where "Share a memory" goes
  donateLink: "https://bigrgolf.com"    // where "Donate" goes
};
