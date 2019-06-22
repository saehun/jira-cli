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
