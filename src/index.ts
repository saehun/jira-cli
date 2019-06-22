import axios from "axios";
import * as R from "ramda";
import * as date from "date-fns";

console.log("JIRA cli -- v1.0.0");
const {
  JIRA_TOKEN,
  JIRA_EMAIL,
  JIRA_PROJECT_KEY,
  JIRA_ENDPOINT,
} = process.env;
const SPRINT_BOARD_ID = "16";

const api = axios.create({
  baseURL: JIRA_ENDPOINT + "/api/2",
  timeout: 5000,
  auth: {
    username: JIRA_EMAIL,
    password: JIRA_TOKEN,
  }
});

const api2 = axios.create({
  baseURL: JIRA_ENDPOINT + "/agile/1.0",
  timeout: 15000,
  auth: {
    username: JIRA_EMAIL,
    password: JIRA_TOKEN,
  }
});

interface User {
  self: string;
  key: string;
  accountId: string;
  accountType: string;
  name: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  displayName: string;
  active: boolean;
  timeZone: string;
  locale: string;
}

interface IssueStatus {
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

interface Issue {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    summary: string;
    assignee?: User;
    status: IssueStatus;
  };
}

interface Sprint {
  id: number;
  self: string;
  state: string;
  name: string;
  startDate: string;
  endDate: string;
  originBoardId: number;
  goal: string;
}

const getAllSprint = async () => {
  const res = await api2.get(`board/${SPRINT_BOARD_ID}/sprint`);
  return res.data.values;
};

const getSprint = async (offset = 0) => {
  const sprints = await getAllSprint();
  const targetDate = date.addWeeks(new Date(), offset);

  return R.find(
    (sprint: Sprint) =>
      R.propSatisfies((endDate: string) => date.isBefore(targetDate, new Date(endDate)), "endDate")(sprint) &&
      R.propSatisfies((startDate: string) => date.isAfter(targetDate, new Date(startDate)), "startDate")(sprint),
    sprints
  ) as Sprint;
};

const getIssueBySprint = async (offset = 0, username?: string, filter?: string) => {
  const sprint = await getSprint(offset);
  const res = await api2.get(`board/${SPRINT_BOARD_ID}/sprint/${sprint.id}/issue?maxResults=200`);

  return res.data;
};

const getAllUsers = async () => {
  const res = await api.get(`user/assignable/search?project=${JIRA_PROJECT_KEY}`);
  const users = res.data as User[];
  return users.filter((user: User) => user.accountType === "atlassian" && user.key !== "admin");
};

const getIssues = async () => {
  const res = await api.post("search", {
    "jql": "project = SB",
    "startAt": 0,
    "maxResults": 200,
    "fields": [
      "summary",
      "status",
      "assignee"
    ]
  });
  return res.data.issues;
};


(async () => {
  try {
    const issues = await getIssueBySprint();
    console.log(issues);
  } catch (e) {
    if (R.path(["response", "status"], e)) {
      const { response: res } = e;
      console.error(res.status, R.path(["data", "errorMessages", "0"], res));
    } else {
      console.error(e);
    }
  }
})();

/* example command

jira ls  -> list all issue
jira ls todo
jira ls karl todo done
jira ls jackie karl todo done
jira ls
jira add karl "............"
jira mv <id> <karl done>
jira rm <id>

*/
