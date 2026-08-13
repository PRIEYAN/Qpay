import { useCallback, useMemo } from 'react';
import { useQpayContext } from '../context/QpayProvider';
import { Contact } from '../services/types';
import {
  AddContactInput,
  addContact as addContactService,
  toggleFavouriteContact as toggleFavouriteContactService,
} from '../services/qpayService';

export type UseContactsResult = {
  /** All contacts, alphabetical by name. */
  data: Contact[];
  /** Contacts ordered by most-recently-paid first (never-paid contacts excluded). */
  recent: Contact[];
  /** Favourited contacts only. */
  favourites: Contact[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  /** In-memory search over name + qpayId — synchronous, no round trip per keystroke. */
  search: (query: string) => Contact[];
  addContact: (input: AddContactInput) => Promise<Contact>;
  toggleFavourite: (id: string) => Promise<Contact>;
};

export function useContacts(): UseContactsResult {
  const { snapshot, loading, error, refresh } = useQpayContext();

  const data = useMemo(
    () => (snapshot ? [...snapshot.contacts].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [snapshot],
  );

  const recent = useMemo(() => {
    const paid = data.filter((c) => c.lastPaidAt != null);
    return paid.sort((a, b) => (b.lastPaidAt as number) - (a.lastPaidAt as number));
  }, [data]);

  const favourites = useMemo(() => data.filter((c) => c.favourite), [data]);

  const search = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return data;
      return data.filter((c) => c.name.toLowerCase().includes(q) || c.qpayId.toLowerCase().includes(q));
    },
    [data],
  );

  const addContact = useCallback(
    async (input: AddContactInput) => {
      const result = await addContactService(input);
      await refresh();
      return result;
    },
    [refresh],
  );

  const toggleFavourite = useCallback(
    async (id: string) => {
      const result = await toggleFavouriteContactService(id);
      await refresh();
      return result;
    },
    [refresh],
  );

  return { data, recent, favourites, loading, error, refresh, search, addContact, toggleFavourite };
}
