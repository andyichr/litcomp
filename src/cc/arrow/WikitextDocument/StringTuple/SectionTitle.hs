import Text.XML.HXT.Parser.XmlParsec
import Text.XML.HXT.DOM.TypeDefs
import Text.XML.HXT.DOM.XmlNode
import Text.JSON

main = interact f where
	f :: String -> String
	f x = encode (map text (concatMap headers (xread x))) ++ "\n" where

		-- reduce an XmlTree to the list of hN XmlTree present in the tree
		headers :: XmlTree -> [XmlTree]
		headers t@(NTree _ u)
			| fitsPattern t = [t]
			| otherwise = concatMap headers u  where
				fitsPattern _ = maybe False i (getLocalPart t) where
					i ['h',_] = True
					i _ = False

		-- reduce XmlTree to the text that it and its decendents contain
		text :: XmlTree -> String
		text t@(NTree (XText u) _) = u
		text t@(NTree _ u) = concatMap text u
