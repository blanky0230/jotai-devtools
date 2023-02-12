import React, { useMemo } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { atom, useAtomValue } from 'jotai';
import { DevTools } from 'jotai-devtools';
import { AnyAtom } from 'src/types';
import { customRender } from '../custom-render';

const BasicAtomsWithDevTools = () => {
  // Create atoms inside the component so that they are recreated for each test
  const countAtom = useMemo(() => atom(0), []);
  countAtom.debugLabel = 'countAtom';
  const doubleAtom = useMemo(
    () => atom((get) => get(countAtom) * 2),
    [countAtom],
  );

  useAtomValue(countAtom);
  useAtomValue(doubleAtom);
  return <DevTools isInitialOpen={true} />;
};

describe('DevTools - AtomViewer', () => {
  describe('List of atoms', () => {
    it('should render atom viewer without any errors if there are no atoms', async () => {
      const { container } = customRender(<DevTools isInitialOpen={true} />);
      await waitFor(() =>
        expect(screen.getByText('👻 Jōtai DevTools')).toBeInTheDocument(),
      );
      expect(screen.getByText('Atom Viewer')).toBeInTheDocument();
      expect(
        screen.getByTestId('atom-list-no-atoms-found-message'),
      ).toHaveTextContent('No Atoms found!');
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Select an atom from the left panel to view the details',
        ),
      ).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render atom viewer with correct atoms without provider', async () => {
      const { container } = customRender(<BasicAtomsWithDevTools />);
      expect(screen.getByText('countAtom')).toBeInTheDocument();
      // We did not add `debugLabel` to `doubleAtom` so it should be unlabeled
      expect(screen.getByText('<unlabeled-atom>')).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    describe('Search', () => {
      it('should search for atoms correctly', async () => {
        const { container } = customRender(<BasicAtomsWithDevTools />);

        await act(async () => {
          await userEvent.type(screen.getByLabelText('Search'), 'count');
        });

        expect(
          screen.queryByTestId('atom-list-no-atoms-found-message'),
        ).not.toBeInTheDocument();
        expect(screen.getByText('countAtom')).toBeInTheDocument();
        expect(screen.queryByText('<unlabeled-atom>')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
      });
      it('should display an error if no atoms are found', async () => {
        const { container } = customRender(<BasicAtomsWithDevTools />);

        await act(async () => {
          await userEvent.type(screen.getByLabelText('Search'), 'abc 123');
        });
        expect(
          screen.getByTestId('atom-list-no-atoms-found-message'),
        ).toHaveTextContent('No Atoms found!');
        expect(screen.queryByText('countAtom')).not.toBeInTheDocument();
        expect(screen.queryByText('<unlabeled-atom>')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
      });
    });
  });

  describe('Atom details', () => {
    describe('Raw value', () => {
      it('should display atom details when an atom is selected', async () => {
        const { container } = customRender(<BasicAtomsWithDevTools />);

        await act(async () => {
          await userEvent.click(screen.getByText('countAtom'));
        });

        expect(screen.getByText('Atom Details')).toBeInTheDocument();
        expect(screen.getByText('Meta')).toBeInTheDocument();
        expect(screen.getByText('Debug Label')).toBeInTheDocument();
        expect(
          screen.getByTestId('display-detail-item-value-countAtom'),
        ).toHaveTextContent('countAtom');
        expect(screen.getByText('Value type')).toBeInTheDocument();
        expect(screen.getByText('number')).toBeInTheDocument();

        expect(screen.getByText('Raw value')).toBeInTheDocument();
        expect(screen.getByTestId('atom-parsed-value')).toHaveTextContent('0');

        expect(screen.getByText('Dependents')).toBeInTheDocument();
        expect(
          screen.getByTestId('dependents-list-item-<unlabeled-atom>-0'),
        ).toBeInTheDocument();
        expect(container).toMatchSnapshot();
      });

      it('should display the dependents of the atom correctly', async () => {
        const { container } = render(<BasicAtomsWithDevTools />);

        await act(async () => {
          await userEvent.click(screen.getByText('<unlabeled-atom>'));
        });

        expect(screen.getByText('Atom Details')).toBeInTheDocument();

        expect(screen.getByText('Dependents')).toBeInTheDocument();
        expect(screen.getByText('No dependents')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
      });

      describe('Supports most primitive value types', () => {
        const AtomRenderer = ({ atom }: { atom: AnyAtom }) => {
          useAtomValue(atom);
          return <DevTools isInitialOpen={true} />;
        };

        it.each`
          type           | value                    | expected
          ${'string'}    | ${'some-string'}         | ${'some-string'}
          ${'number'}    | ${123}                   | ${123}
          ${'boolean'}   | ${true}                  | ${true}
          ${'boolean'}   | ${false}                 | ${false}
          ${'null'}      | ${null}                  | ${'null'}
          ${'undefined'} | ${undefined}             | ${'undefined'}
          ${'bigint'}    | ${BigInt(123)}           | ${'123'}
          ${'symbol'}    | ${Symbol('some-symbol')} | ${'Symbol(some-symbol)'}
          ${'function'}  | ${() => () => 'hello'}   | ${"()=>'hello'"}
          ${'object'}    | ${{ foo: 'bar' }}        | ${'{ "foo": "bar"}'}
          ${'array'}     | ${[1, 2, 3]}             | ${'[ 1, 2, 3]'}
        `(
          'should parse "$type" value correctly',
          async ({ value, expected }) => {
            const valueAtom = atom(value);
            valueAtom.debugLabel = 'valueAtom';

            customRender(<AtomRenderer atom={valueAtom} />);

            await act(async () => {
              await userEvent.click(screen.getByText('valueAtom'));
            });

            expect(screen.getByTestId('atom-parsed-value')).toHaveTextContent(
              expected,
            );
          },
        );
      });
    });

    describe('Deep nested values', () => {
      it('should display atom details with deeply parsed value when an atom is selected', async () => {
        const NestedAtomsWithDevTools = () => {
          // Create atoms inside the component so that they are recreated for each test
          const countAtom = useMemo(() => atom(0), []);
          countAtom.debugLabel = 'countAtom';

          const doubleNestedAtom = useMemo(
            () => atom(atom((get) => get(countAtom) * 2 + 1)),
            [countAtom],
          );

          useAtomValue(countAtom);
          useAtomValue(doubleNestedAtom);
          return (
            <DevTools
              isInitialOpen={true}
              options={{ atomValueParser: 'deep-nested' }}
            />
          );
        };

        const { container } = customRender(<NestedAtomsWithDevTools />);

        await act(async () => {
          await userEvent.click(screen.getByText('<unlabeled-atom>'));
        });

        expect(screen.getByText('Atom Details')).toBeInTheDocument();
        expect(screen.getByText('Meta')).toBeInTheDocument();
        expect(screen.getByText('Debug Label')).toBeInTheDocument();
        expect(
          screen.getByTestId('display-detail-item-value-<unlabeled-atom>'),
        ).toHaveTextContent('<unlabeled-atom>');
        expect(screen.getByText('Value type')).toBeInTheDocument();
        expect(
          screen.getByTestId('display-detail-item-value-atom'),
        ).toHaveTextContent('atom');

        expect(screen.getByText('Parsed value')).toBeInTheDocument();
        expect(screen.getByTestId('atom-parsed-value')).toHaveTextContent('1');

        expect(screen.getByText('Dependents')).toBeInTheDocument();
        // There are no dependents for this atom yet because those dependents are not yet mounted
        expect(screen.getByText('No dependents')).toBeInTheDocument();
        await waitFor(() => expect(container).toMatchSnapshot());
      });

      describe('Supports most primitive value types', () => {
        const AtomRenderer = ({ atom }: { atom: AnyAtom }) => {
          useAtomValue(atom);
          return (
            <DevTools
              isInitialOpen={true}
              options={{
                atomValueParser: 'deep-nested',
              }}
            />
          );
        };

        it.each`
          type           | value                    | expected
          ${'string'}    | ${'some-string'}         | ${'some-string'}
          ${'number'}    | ${123}                   | ${123}
          ${'boolean'}   | ${true}                  | ${true}
          ${'boolean'}   | ${false}                 | ${false}
          ${'null'}      | ${null}                  | ${'null'}
          ${'undefined'} | ${undefined}             | ${'undefined'}
          ${'bigint'}    | ${BigInt(123)}           | ${'123'}
          ${'symbol'}    | ${Symbol('some-symbol')} | ${'Symbol(some-symbol)'}
          ${'function'}  | ${() => () => 'hello'}   | ${"()=>'hello'"}
          ${'object'}    | ${{ foo: 'bar' }}        | ${'{ "foo": "bar"}'}
          ${'array'}     | ${[1, 2, 3]}             | ${'[ 1, 2, 3]'}
        `(
          'should parse "$type" value correctly',
          async ({ value, expected }) => {
            const valueAtom = atom(value);
            valueAtom.debugLabel = 'valueAtom';

            customRender(<AtomRenderer atom={valueAtom} />);

            await act(async () => {
              await userEvent.click(screen.getByText('valueAtom'));
            });

            expect(screen.getByTestId('atom-parsed-value')).toHaveTextContent(
              expected,
            );
          },
        );
      });
    });
  });
});
