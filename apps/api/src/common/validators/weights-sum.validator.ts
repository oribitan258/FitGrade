import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Cross-field validator: the decorated integer field + the named sibling field
 * must sum to exactly 100.
 *
 * Usage:
 *   @WeightsSumTo100('siblingFieldName')
 *   fitnessWeight: number;
 */
export function WeightsSumTo100(
  siblingProperty: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'weightsSumTo100',
      target: object.constructor,
      propertyName: propertyName as string,
      constraints: [siblingProperty],
      options: {
        message: 'משקל הכושר ומשקל התלמידות חייבים לסכום ל-100',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [sibling] = args.constraints as [string];
          const siblingValue = (args.object as Record<string, unknown>)[sibling];
          if (typeof value !== 'number' || typeof siblingValue !== 'number') return true;
          return value + siblingValue === 100;
        },
      },
    });
  };
}
