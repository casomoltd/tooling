/**
 * The translator's test form: every question kind, rule and condition the
 * engine writes, in the shapes Tally has accepted, small enough that a test
 * can name each block it expects.
 */

/** @import {FormDefinition} from "./index.d.mts" */

/** The range a typed salary must fall in. */
const SALARY = {min: 1_000, max: 500_000};
/** The range a typed count must fall in. */
const COUNT = {min: 0, max: 10};

/** @type {FormDefinition} */
export const fixtureForm = {
  key: "builder-fixture",
  title: "Builder fixture",
  pageButton: "Continue",
  locale: {currencyFormat: "POUND", currencySymbol: "£", dateFormat: "dd/MM/yyyy"},
  settings: {
    hasProgressBar: false, saveForLater: false, hasPartialSubmissions: false,
    pageAutoJump: false, badges: false,
  },
  pages: [
    {
      key: "about-you",
      items: [
        {kind: "hiddenFields", key: "context", fields: ["source", "divisor"]},
        {kind: "text", key: "name", title: "Your name", required: true},
        {kind: "email", key: "email", title: "Your email", required: true,
          verify: true},
        {kind: "money", key: "salary", title: "Salary", required: true, range: SALARY},
        {kind: "number", key: "count", title: "How many", required: false, range: COUNT,
          rangeMessage: (r) => `Between ${r.min} and ${r.max}.`},
        {kind: "date", key: "born", title: "Date of birth", required: true,
          disable: "future", dateRange: {from: "1940-01-01", to: "2010-01-01"}},
        {kind: "date", key: "started", title: "Start date", required: true,
          disable: "future"},
        {kind: "note", key: "no-source", text: "Open this form from our site.",
          showWhen: [{kind: "empty", question: "source"}]},
      ],
      rules: [
        {kind: "ratio", key: "salary-per", name: "Salary per", numerator: "salary",
          denominator: "divisor"},
        {kind: "reject", key: "started-before-born",
          when: [{kind: "dateBeforeAnswer", question: "started", other: "born"}],
          message: "You can't start before you were born."},
        {kind: "jump", key: "skip-choices", to: "last",
          when: [{kind: "below", calculation: "salary-per", value: 1}]},
      ],
    },
    {
      key: "choices",
      items: [
        {kind: "choice", key: "plan", title: "Do you have a plan?", required: true,
          options: [{key: "yes", label: "Yes"}, {key: "no", label: "No"}]},
        {kind: "date", key: "plan_date", title: "Plan date",
          help: "The date the plan is drawn to.", required: true,
          showWhen: [{kind: "chose", question: "plan", options: ["yes"]}]},
        {kind: "longText", key: "why", title: "Why", required: false,
          placeholder: "Because",
          showWhen: [
            {kind: "outside", question: "salary", range: {min: 10_000, max: 90_000}},
            {kind: "either", conditions: [
              {kind: "dateBefore", question: "started", date: "2008-04-01"},
              {kind: "dateAfter", question: "started", date: "2008-03-31"},
            ]},
          ]},
        {kind: "dropdown", key: "region", title: "Region", required: true,
          options: [{key: "north", label: "North"}, {key: "south", label: "South"}]},
      ],
    },
    {
      key: "last",
      items: [
        {kind: "checkbox", key: "consent", title: "Before you submit", required: true,
          options: [{key: "accepted", label: "Use these details to reply to me."}]},
      ],
    },
  ],
  thankYou: [{kind: "note", key: "thanks", text: "Thanks."}],
};
