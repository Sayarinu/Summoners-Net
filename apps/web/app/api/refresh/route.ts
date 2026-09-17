import { mutate } from "../../../src/server/http";
export const POST = (request: Request) => mutate(request, "refresh");
