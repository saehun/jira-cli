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
