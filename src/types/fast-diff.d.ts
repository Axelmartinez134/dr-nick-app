declare module "fast-diff" {
  type DiffOp = -1 | 0 | 1;
  type DiffTuple = [DiffOp, string];

  export default function diff(text1: string, text2: string): DiffTuple[];
}

